import request, { type Response } from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import type { Prisma } from '../../src/generated/prisma/client.js';
import { SLA_HOURS } from '../../src/modules/tickets/ticket-sla.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';
import { ticketInProgress as openTicketInProgress, waitingFor } from '../helpers/tickets.js';

const HOUR = 3_600_000;

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

const ticketInProgress = () => openTicketInProgress(data.category.id);

/**
 * Espera até a requisição estar parada, aguardando o bloqueio que esta transação segura. Lê pg_locks
 * (o PostgreSQL inteiro, com os outros bancos: pg_blocking_pids filtra quem espera por esta transação),
 * e não pg_stat_activity, que o PostgreSQL congela na 1ª leitura dentro de uma transação.
 */
async function untilSomeoneWaitsForTheRow(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const [row] = await tx.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_locks
      WHERE NOT granted AND pg_backend_pid() = ANY (pg_blocking_pids(pid))
    `;
    if (row && row.waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('A requisição não chegou a esperar pelo bloqueio da linha.');
}

/**
 * Simula outra pessoa alterando o chamado no mesmo instante: uma transação altera a linha e só
 * confirma depois que a requisição já leu a versão antiga e ficou esperando para gravar.
 */
async function whileSomeoneElseChanges(ticketId: string, send: () => PromiseLike<Response>) {
  let pending: Promise<Response> | undefined;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticketId }, data: { title: 'Alterado por outra pessoa' } });
    pending = Promise.resolve(send());
    await untilSomeoneWaitsForTheRow(tx);
  });

  if (!pending) throw new Error('A requisição não foi enviada.');
  return pending;
}

describe('alterações simultâneas no mesmo chamado', () => {
  it('a alteração calculada sobre uma versão antiga recebe 409, em vez de sobrescrever a outra', async () => {
    const agent = await authHeader('agent@test.example');
    const ticket = await ticketInProgress();

    const response = await whileSomeoneElseChanges(ticket.id, () =>
      request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ priority: 'HIGH' }),
    );
    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(agent);
    const events = await request(app).get(`/api/tickets/${ticket.id}/events`).set(agent);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_CHANGED');
    expect(after.body.data.title).toBe('Alterado por outra pessoa');
    expect(after.body.data.priority).toBe('MEDIUM');
    // O histórico também não registra a alteração recusada: só o início do atendimento.
    expect(events.body.data.map((event: { field: string }) => event.field)).toEqual(['STATUS', 'ASSIGNEE']);
  });

  it('a resposta do solicitante a um chamado que mudou nesse meio-tempo recebe 409, e nada é gravado', async () => {
    const ana = await authHeader('ana@test.example');
    const ticket = await ticketInProgress();
    await waitingFor(ticket.id, 2);

    const response = await whileSomeoneElseChanges(ticket.id, () =>
      request(app).post(`/api/tickets/${ticket.id}/comments`).set(ana).send({ body: 'Pode vir amanhã às 10h.' }),
    );
    const comments = await request(app).get(`/api/tickets/${ticket.id}/comments`).set(ana);
    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(ana);
    const events = await request(app).get(`/api/tickets/${ticket.id}/events`).set(ana);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_CHANGED');
    expect(comments.body.data).toEqual([]);
    expect(after.body.data.status).toBe('WAITING_REQUESTER');
    // Nem a volta para atendimento entrou no histórico: o último evento ainda é a ida para a espera.
    expect(events.body.data.map((event: { to: unknown }) => event.to).at(-1)).toBe('WAITING_REQUESTER');
  });

  it('sair da espera e trocar a prioridade ao mesmo tempo nunca perde uma das contas', async () => {
    const agent = await authHeader('agent@test.example');
    const admin = await authHeader('admin@test.example');

    for (let round = 0; round < 5; round++) {
      const ticket = await ticketInProgress();
      await waitingFor(ticket.id, 3);

      const responses = await Promise.all([
        request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'IN_PROGRESS' }),
        request(app).patch(`/api/tickets/${ticket.id}`).set(admin).send({ priority: 'HIGH' }),
      ]);
      const after = (await request(app).get(`/api/tickets/${ticket.id}`).set(agent)).body.data;

      // Pelo menos uma alteração vale; a outra também vale ou é recusada inteira, com 409.
      expect(responses.map((response) => response.status)).toContain(200);
      for (const response of responses) {
        if (response.status !== 200) expect(response.body.error.code).toBe('TICKET_CHANGED');
      }
      // O prazo final soma tudo o que valeu: o SLA da prioridade final e, se saiu da espera, a pausa.
      const pause = after.waitingSince === null ? 3 * HOUR : 0;
      const expected = Date.parse(ticket.createdAt) + SLA_HOURS[after.priority as 'MEDIUM' | 'HIGH'] * HOUR + pause;
      expect(Date.parse(after.dueAt) - expected).toBeGreaterThanOrEqual(0);
      expect(Date.parse(after.dueAt) - expected).toBeLessThan(60_000);
    }
  });

  it('reenviar o mesmo título e a mesma descrição não grava nada (e não gera 409 para quem altera junto)', async () => {
    const ana = await authHeader('ana@test.example');
    const opened = await request(app)
      .post('/api/tickets')
      .set(ana)
      .send({ title: 'Teclado não funciona', description: 'Nenhuma tecla responde.', categoryId: data.category.id });

    const response = await request(app)
      .patch(`/api/tickets/${opened.body.data.id}`)
      .set(ana)
      .send({ title: opened.body.data.title, description: opened.body.data.description });

    expect(response.status).toBe(200);
    expect(response.body.data.updatedAt).toBe(opened.body.data.updatedAt);
  });
});
