import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

/** Abre um chamado pela API, como o usuário informado. */
async function openTicket(email: string, overrides: Record<string, unknown> = {}) {
  const response = await request(app)
    .post('/api/tickets')
    .set(await authHeader(email))
    .send({
      title: 'Teclado não funciona',
      description: 'Nenhuma tecla responde desde hoje cedo.',
      priority: 'URGENT',
      categoryId: data.category.id,
      ...overrides,
    });

  expect(response.status).toBe(201);
  return response.body.data;
}

describe('abertura de chamado', () => {
  it('calcula o prazo pelo SLA da prioridade', async () => {
    const ticket = await openTicket('ana@test.example');
    const hours = (Date.parse(ticket.dueAt) - Date.parse(ticket.createdAt)) / 3_600_000;

    expect(hours).toBe(4);
    expect(ticket).toMatchObject({ number: 1, status: 'OPEN', isOverdue: false, assignee: null });
  });

  it('mostra todos os erros de validação de uma vez', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set(await authHeader('ana@test.example'))
      .send({ title: 'Oi', categoryId: 'nao-e-uuid' });

    expect(response.status).toBe(400);
    const fields = response.body.error.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'description', 'categoryId']));
  });
});

describe('visibilidade por perfil', () => {
  it('o solicitante só vê os próprios chamados; a equipe vê todos', async () => {
    await openTicket('ana@test.example');
    await openTicket('bruno@test.example');

    const asAna = await request(app).get('/api/tickets').set(await authHeader('ana@test.example'));
    const asAgent = await request(app).get('/api/tickets').set(await authHeader('agent@test.example'));

    expect(asAna.body.meta.total).toBe(1);
    expect(asAna.body.data[0].requester.name).toBe('Ana Teste');
    expect(asAgent.body.meta.total).toBe(2);
  });

  it('o chamado de outra pessoa responde 404, e não 403', async () => {
    const ticket = await openTicket('ana@test.example');

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set(await authHeader('bruno@test.example'));

    expect(response.status).toBe(404);
  });
});

describe('fluxo de status', () => {
  it('quem inicia o atendimento assume o chamado', async () => {
    const ticket = await openTicket('ana@test.example');

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(await authHeader('agent@test.example'))
      .send({ status: 'IN_PROGRESS' });

    expect(response.status).toBe(200);
    expect(response.body.data.assignee).toEqual({ id: data.agent.id, name: 'Técnico Teste' });
  });

  it('recusa uma mudança fora do fluxo e informa as permitidas', async () => {
    const ticket = await openTicket('ana@test.example');
    const agent = await authHeader('agent@test.example');

    await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'IN_PROGRESS' });
    const response = await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'CLOSED' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(response.body.error.details.allowed).toEqual(['OPEN', 'WAITING_REQUESTER', 'RESOLVED']);
  });

  it('o solicitante não pode alterar a prioridade', async () => {
    const ticket = await openTicket('ana@test.example');

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(await authHeader('ana@test.example'))
      .send({ priority: 'LOW' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('STAFF_ONLY_FIELDS');
  });
});

describe('filtros e paginação', () => {
  it('filtra os atrasados e pagina o resultado', async () => {
    const first = await openTicket('ana@test.example');
    const second = await openTicket('ana@test.example');
    await openTicket('ana@test.example');

    // Prepara o cenário direto no banco: dois chamados com o prazo já vencido.
    // (abertos há 2 horas: o banco exige que o prazo seja posterior à abertura)
    await prisma.ticket.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { createdAt: new Date(Date.now() - 2 * 3_600_000), dueAt: new Date(Date.now() - 60_000) },
    });

    const response = await request(app)
      .get('/api/tickets?overdue=true&pageSize=1')
      .set(await authHeader('agent@test.example'));

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].isOverdue).toBe(true);
  });
});

describe('comentários', () => {
  it('notas internas ficam invisíveis para o solicitante', async () => {
    const ticket = await openTicket('ana@test.example');
    const agent = await authHeader('agent@test.example');

    await request(app).post(`/api/tickets/${ticket.id}/comments`).set(agent).send({ body: 'Vou verificar.' });
    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(agent)
      .send({ body: 'Provável troca de teclado.', isInternal: true });

    const asAgent = await request(app).get(`/api/tickets/${ticket.id}/comments`).set(agent);
    const asAna = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set(await authHeader('ana@test.example'));

    expect(asAgent.body.data).toHaveLength(2);
    expect(asAna.body.data).toHaveLength(1);
    expect(asAna.body.data[0].isInternal).toBe(false);
  });

  it('a resposta do solicitante devolve o chamado para atendimento', async () => {
    const ticket = await openTicket('ana@test.example');
    const agent = await authHeader('agent@test.example');
    const ana = await authHeader('ana@test.example');

    await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'IN_PROGRESS' });
    await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'WAITING_REQUESTER' });
    await request(app).post(`/api/tickets/${ticket.id}/comments`).set(ana).send({ body: 'Já reiniciei o computador.' });

    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(ana);

    expect(after.body.data.status).toBe('IN_PROGRESS');
  });
});
