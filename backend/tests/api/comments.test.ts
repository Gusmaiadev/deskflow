import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';
import { ticketInProgress, waitingFor } from '../helpers/tickets.js';

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

/** Abre um chamado da Ana pela API; ele fica aberto (OPEN), ainda sem atendimento. */
async function openTicket() {
  const response = await request(app)
    .post('/api/tickets')
    .set(await authHeader('ana@test.example'))
    .send({ title: 'Teclado não funciona', description: 'Nenhuma tecla responde.', categoryId: data.category.id });

  expect(response.status).toBe(201);
  return response.body.data;
}

/** Os textos dos comentários gravados no chamado, direto do banco (notas internas incluídas). */
async function storedComments(ticketId: string): Promise<string[]> {
  const comments = await prisma.ticketComment.findMany({ where: { ticketId }, orderBy: { createdAt: 'asc' } });
  return comments.map((comment) => comment.body);
}

describe('acesso aos comentários', () => {
  it('segue o acesso ao chamado: outro solicitante não lê nem comenta o chamado alheio (404)', async () => {
    const ticket = await openTicket();
    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(await authHeader('ana@test.example'))
      .send({ body: 'Meu ramal é 2040.' });
    const bruno = await authHeader('bruno@test.example');

    const read = await request(app).get(`/api/tickets/${ticket.id}/comments`).set(bruno);
    const write = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(bruno)
      .send({ body: 'Aqui também não funciona.' });
    const comments = await storedComments(ticket.id);

    expect(read.status).toBe(404);
    expect(read.body.error.code).toBe('TICKET_NOT_FOUND');
    expect(write.status).toBe(404);
    expect(write.body.error.code).toBe('TICKET_NOT_FOUND');
    expect(comments).toEqual(['Meu ramal é 2040.']);
  });
});

describe('comentários recusados', () => {
  it('um chamado fechado não aceita mais comentários, nem as notas internas da equipe', async () => {
    const ana = await authHeader('ana@test.example');
    const agent = await authHeader('agent@test.example');
    const ticket = await openTicket();
    // O técnico pode fechar direto um chamado aberto (OPEN -> CLOSED).
    const closed = await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'CLOSED' });
    expect(closed.status).toBe(200);

    const fromRequester = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(ana)
      .send({ body: 'O teclado voltou a falhar.' });
    const fromStaff = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(agent)
      .send({ body: 'Trocar o teclado na próxima visita.', isInternal: true });
    const comments = await storedComments(ticket.id);

    expect(fromRequester.status).toBe(409);
    expect(fromRequester.body.error.code).toBe('TICKET_CLOSED');
    expect(fromStaff.status).toBe(409);
    expect(fromStaff.body.error.code).toBe('TICKET_CLOSED');
    expect(comments).toEqual([]);
  });

  it('a nota interna do solicitante recebe 403: não vira comentário comum nem tira o chamado da espera', async () => {
    const ticket = await ticketInProgress(data.category.id);
    await waitingFor(ticket.id, 2);
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(await authHeader('ana@test.example'))
      .send({ body: 'Pode vir amanhã às 10h.', isInternal: true });
    const comments = await storedComments(ticket.id);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('INTERNAL_NOTE_FORBIDDEN');
    expect(comments).toEqual([]);
    // A recusa não conta como resposta: o chamado segue intocado, aguardando a Ana e com o relógio do SLA parado.
    expect(after).toEqual(before);
    expect(after.status).toBe('WAITING_REQUESTER');
  });
});
