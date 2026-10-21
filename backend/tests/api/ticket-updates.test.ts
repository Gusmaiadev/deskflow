import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';
import { ticketInProgress as openTicketInProgress } from '../helpers/tickets.js';

/** Um id bem formado, mas que não pertence a nenhum registro. */
const UNKNOWN_ID = '01a0f3af-7c12-75ae-9d42-d46c05d373b0';

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

/** Chamado da Ana (prioridade média) que o técnico já começou a atender. */
const ticketInProgress = () => openTicketInProgress(data.category.id);

/** Abre um chamado como a Ana: ele fica aberto (OPEN), sem responsável. */
async function openTicket() {
  const response = await request(app)
    .post('/api/tickets')
    .set(await authHeader('ana@test.example'))
    .send({ title: 'Teclado não funciona', description: 'Nenhuma tecla responde.', categoryId: data.category.id });

  expect(response.status).toBe(201);
  return response.body.data;
}

/** Uma categoria que existe, mas foi desativada: não recebe mais chamados. */
const inactiveCategory = () => prisma.category.create({ data: { name: 'Telefonia', isActive: false } });

describe('categoria do chamado', () => {
  it('a abertura recusa uma categoria inexistente ou desativada', async () => {
    const ana = await authHeader('ana@test.example');
    const telefonia = await inactiveCategory();
    const ticket = { title: 'Telefone sem linha', description: 'O ramal 2040 não dá linha desde ontem.' };

    const unknown = await request(app).post('/api/tickets').set(ana).send({ ...ticket, categoryId: UNKNOWN_ID });
    const inactive = await request(app).post('/api/tickets').set(ana).send({ ...ticket, categoryId: telefonia.id });
    const saved = await prisma.ticket.count();

    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('INVALID_CATEGORY');
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.code).toBe('INVALID_CATEGORY');
    expect(saved).toBe(0);
  });

  it('a equipe move o chamado para outra categoria', async () => {
    const perifericos = await prisma.category.create({ data: { name: 'Periféricos' } });
    const ticket = await openTicket();

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(await authHeader('agent@test.example'))
      .send({ categoryId: perifericos.id });

    expect(response.status).toBe(200);
    expect(response.body.data.category).toEqual({ id: perifericos.id, name: 'Periféricos' });
  });

  it('a equipe não move o chamado para uma categoria inexistente ou desativada', async () => {
    const agent = await authHeader('agent@test.example');
    const telefonia = await inactiveCategory();
    const ticket = await openTicket();
    const move = (categoryId: string) =>
      request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ categoryId });

    const unknown = await move(UNKNOWN_ID);
    const inactive = await move(telefonia.id);
    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(agent);

    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('INVALID_CATEGORY');
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.code).toBe('INVALID_CATEGORY');
    expect(after.body.data.category).toEqual({ id: data.category.id, name: 'Hardware' });
  });
});

describe('responsável pelo chamado', () => {
  it('recusa um solicitante, um técnico desativado e um id que não existe', async () => {
    const admin = await authHeader('admin@test.example');
    const ticket = await openTicket();
    await prisma.user.update({ where: { id: data.agent.id }, data: { isActive: false } });
    const assign = (assigneeId: string) =>
      request(app).patch(`/api/tickets/${ticket.id}`).set(admin).send({ assigneeId });

    const requester = await assign(data.ana.id);
    const inactiveAgent = await assign(data.agent.id);
    const unknown = await assign(UNKNOWN_ID);
    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(admin);

    expect(requester.status).toBe(400);
    expect(requester.body.error.code).toBe('INVALID_ASSIGNEE');
    expect(inactiveAgent.status).toBe(400);
    expect(inactiveAgent.body.error.code).toBe('INVALID_ASSIGNEE');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('INVALID_ASSIGNEE');
    expect(after.body.data.assignee).toBeNull();
  });
});

describe('título e descrição', () => {
  it('enquanto o chamado está aberto, o solicitante corrige o título e a descrição', async () => {
    const ticket = await openTicket();

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(await authHeader('ana@test.example'))
      .send({ title: 'Teclado sem fio não funciona', description: 'Nenhuma tecla responde, nem com pilhas novas.' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      title: 'Teclado sem fio não funciona',
      description: 'Nenhuma tecla responde, nem com pilhas novas.',
    });
  });

  it('depois que o atendimento começa, o solicitante não edita mais o título nem a descrição', async () => {
    const ana = await authHeader('ana@test.example');
    const ticket = await ticketInProgress();

    const title = await request(app).patch(`/api/tickets/${ticket.id}`).set(ana).send({ title: 'Monitor com defeito' });
    const description = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(ana)
      .send({ description: 'Agora a tela também fica preta.' });
    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(ana);

    expect(title.status).toBe(409);
    expect(title.body.error.code).toBe('TICKET_NOT_EDITABLE');
    expect(description.status).toBe(409);
    expect(description.body.error.code).toBe('TICKET_NOT_EDITABLE');
    expect(after.body.data).toMatchObject({ title: ticket.title, description: ticket.description });
  });

  it('a equipe corrige a descrição mesmo com o chamado em atendimento', async () => {
    const ticket = await ticketInProgress();

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(await authHeader('agent@test.example'))
      .send({ description: 'A tela pisca quando o cabo HDMI é mexido.' });

    expect(response.status).toBe(200);
    expect(response.body.data.description).toBe('A tela pisca quando o cabo HDMI é mexido.');
  });
});

describe('resolução e fechamento', () => {
  it('reabrir um chamado resolvido apaga o resolvedAt, e resolver de novo grava um novo', async () => {
    const agent = await authHeader('agent@test.example');
    const ana = await authHeader('ana@test.example');
    const ticket = await ticketInProgress();

    const resolved = await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'RESOLVED' });
    const reopened = await request(app).patch(`/api/tickets/${ticket.id}`).set(ana).send({ status: 'IN_PROGRESS' });
    const resolvedAgain = await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'RESOLVED' });

    expect(resolved.body.data.resolvedAt).not.toBeNull();
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.resolvedAt).toBeNull();
    expect(Date.parse(resolvedAgain.body.data.resolvedAt)).toBeGreaterThan(Date.parse(resolved.body.data.resolvedAt));
  });

  it('confirmar a solução grava o closedAt e mantém o resolvedAt', async () => {
    const ana = await authHeader('ana@test.example');
    const ticket = await ticketInProgress();
    const resolved = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(await authHeader('agent@test.example'))
      .send({ status: 'RESOLVED' });

    const sentAt = Date.now();
    const closed = await request(app).patch(`/api/tickets/${ticket.id}`).set(ana).send({ status: 'CLOSED' });
    const answeredAt = Date.now();

    expect(closed.status).toBe(200);
    // O instante do fechamento, gravado durante a requisição (NaN, e o teste falha, se ficou vazio).
    expect(Date.parse(closed.body.data.closedAt)).toBeGreaterThanOrEqual(sentAt);
    expect(Date.parse(closed.body.data.closedAt)).toBeLessThanOrEqual(answeredAt);
    expect(closed.body.data.resolvedAt).toBe(resolved.body.data.resolvedAt);
  });

  it('um chamado fechado não aceita mais alterações, nem da equipe nem do solicitante', async () => {
    const agent = await authHeader('agent@test.example');
    const ana = await authHeader('ana@test.example');
    const ticket = await openTicket();
    await request(app).patch(`/api/tickets/${ticket.id}`).set(ana).send({ status: 'CLOSED' }); // a Ana cancela

    const byAgent = await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ priority: 'HIGH' });
    const byAna = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(ana)
      .send({ title: 'Teclado e mouse não funcionam' });
    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(agent);

    expect(byAgent.status).toBe(409);
    expect(byAgent.body.error.code).toBe('TICKET_CLOSED');
    expect(byAna.status).toBe(409);
    expect(byAna.body.error.code).toBe('TICKET_CLOSED');
    expect(after.body.data).toMatchObject({ status: 'CLOSED', priority: 'MEDIUM', title: ticket.title });
  });
});
