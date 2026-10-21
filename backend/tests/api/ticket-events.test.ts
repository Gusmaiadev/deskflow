import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';
import { ticketInProgress } from '../helpers/tickets.js';

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

type TicketEvent = { field: string; from: unknown; to: unknown; actor: { name: string } };

/** O histórico sem ids e datas, para comparar a linha do tempo de uma vez. */
const timeline = (events: TicketEvent[]) =>
  events.map(({ field, from, to, actor }) => ({ field, from, to, actor: actor.name }));

describe('GET /api/tickets/:id/events', () => {
  it('registra a linha do tempo: quem mudou o quê, de qual valor para qual', async () => {
    const agent = await authHeader('agent@test.example');
    const ana = await authHeader('ana@test.example');
    const ticket = await ticketInProgress(data.category.id);

    await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ priority: 'HIGH' });
    await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'WAITING_REQUESTER' });
    await request(app).post(`/api/tickets/${ticket.id}/comments`).set(ana).send({ body: 'Pode vir amanhã às 10h.' });
    await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'RESOLVED' });
    const response = await request(app).get(`/api/tickets/${ticket.id}/events`).set(ana);

    expect(response.status).toBe(200);
    expect(timeline(response.body.data)).toEqual([
      { field: 'STATUS', from: 'OPEN', to: 'IN_PROGRESS', actor: 'Técnico Teste' },
      { field: 'ASSIGNEE', from: null, to: { id: data.agent.id, name: 'Técnico Teste' }, actor: 'Técnico Teste' },
      { field: 'PRIORITY', from: 'MEDIUM', to: 'HIGH', actor: 'Técnico Teste' },
      { field: 'STATUS', from: 'IN_PROGRESS', to: 'WAITING_REQUESTER', actor: 'Técnico Teste' },
      { field: 'STATUS', from: 'WAITING_REQUESTER', to: 'IN_PROGRESS', actor: 'Ana Teste' },
      { field: 'STATUS', from: 'IN_PROGRESS', to: 'RESOLVED', actor: 'Técnico Teste' },
    ]);
  });

  it('trocar e tirar o responsável guarda quem era e quem ficou, mesmo num chamado sem histórico', async () => {
    const admin = await authHeader('admin@test.example');
    const opened = await request(app)
      .post('/api/tickets')
      .set(await authHeader('ana@test.example'))
      .send({ title: 'Teclado não funciona', description: 'Nenhuma tecla responde.', categoryId: data.category.id });
    // Como nos chamados do seed: já tem responsável, mas nenhum evento.
    await prisma.ticket.update({ where: { id: opened.body.data.id }, data: { assigneeId: data.agent.id } });

    await request(app).patch(`/api/tickets/${opened.body.data.id}`).set(admin).send({ assigneeId: data.admin.id });
    await request(app).patch(`/api/tickets/${opened.body.data.id}`).set(admin).send({ assigneeId: null });
    const response = await request(app).get(`/api/tickets/${opened.body.data.id}/events`).set(admin);

    expect(timeline(response.body.data)).toEqual([
      {
        field: 'ASSIGNEE',
        from: { id: data.agent.id, name: 'Técnico Teste' },
        to: { id: data.admin.id, name: 'Admin Teste' },
        actor: 'Admin Teste',
      },
      { field: 'ASSIGNEE', from: { id: data.admin.id, name: 'Admin Teste' }, to: null, actor: 'Admin Teste' },
    ]);
  });

  it('o banco recusa eventos com valores que não combinam com o campo', async () => {
    const ticket = await ticketInProgress(data.category.id);
    const base = { ticketId: ticket.id, actorId: data.agent.id };
    const insert = (event: { field: 'STATUS' | 'PRIORITY' | 'ASSIGNEE'; fromValue: string | null; toValue: string | null }) =>
      prisma.ticketEvent.create({ data: { ...base, ...event } });

    await expect(insert({ field: 'STATUS', fromValue: 'OPEN', toValue: 'ARQUIVADO' })).rejects.toThrow();
    await expect(insert({ field: 'PRIORITY', fromValue: 'LOW', toValue: 'OPEN' })).rejects.toThrow();
    await expect(insert({ field: 'ASSIGNEE', fromValue: null, toValue: 'nao-e-um-uuid' })).rejects.toThrow();
    await expect(insert({ field: 'ASSIGNEE', fromValue: null, toValue: data.agent.id.toUpperCase() })).rejects.toThrow();
    await expect(insert({ field: 'STATUS', fromValue: 'OPEN', toValue: 'OPEN' })).rejects.toThrow();
    await expect(insert({ field: 'ASSIGNEE', fromValue: null, toValue: data.admin.id })).resolves.toBeDefined();
  });

  it('segue o acesso ao chamado: o histórico do chamado de outra pessoa "não existe"', async () => {
    const ticket = await ticketInProgress(data.category.id);

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}/events`)
      .set(await authHeader('bruno@test.example'));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('eventos do mesmo instante saem numa ordem estável: status, prioridade e responsável', async () => {
    const agent = await authHeader('agent@test.example');
    const ticket = await ticketInProgress(data.category.id);
    const sameInstant = new Date(Date.now() + 60 * 60 * 1000); // depois do início do atendimento, qualquer que seja o relógio do banco
    const base = { ticketId: ticket.id, actorId: data.agent.id, createdAt: sameInstant };

    // Gravados fora de ordem de propósito.
    await prisma.ticketEvent.createMany({
      data: [
        { ...base, field: 'ASSIGNEE', fromValue: data.agent.id, toValue: null },
        { ...base, field: 'PRIORITY', fromValue: 'MEDIUM', toValue: 'LOW' },
        { ...base, field: 'STATUS', fromValue: 'IN_PROGRESS', toValue: 'OPEN' },
      ],
    });
    const response = await request(app).get(`/api/tickets/${ticket.id}/events`).set(agent);

    expect(response.body.data.slice(-3).map((event: TicketEvent) => event.field)).toEqual(['STATUS', 'PRIORITY', 'ASSIGNEE']);
  });

  it('alterações que não mudam status, prioridade nem responsável não entram no histórico', async () => {
    const agent = await authHeader('agent@test.example');
    const ticket = await ticketInProgress(data.category.id);

    await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(agent)
      .send({ status: 'IN_PROGRESS', priority: 'MEDIUM', assigneeId: data.agent.id, title: 'Monitor piscando muito' });
    const response = await request(app).get(`/api/tickets/${ticket.id}/events`).set(agent);

    // Só os dois eventos do início do atendimento.
    expect(response.body.data.map((event: TicketEvent) => event.field)).toEqual(['STATUS', 'ASSIGNEE']);
  });
});
