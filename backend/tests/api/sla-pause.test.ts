import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';

const HOUR = 3_600_000;

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

/** Abre um chamado de prioridade média (24 h de SLA), e o técnico começa o atendimento. */
async function ticketInProgress() {
  const opened = await request(app)
    .post('/api/tickets')
    .set(await authHeader('ana@test.example'))
    .send({ title: 'Monitor piscando', description: 'A tela pisca a cada poucos segundos.', categoryId: data.category.id });
  expect(opened.status).toBe(201);

  const started = await request(app)
    .patch(`/api/tickets/${opened.body.data.id}`)
    .set(await authHeader('agent@test.example'))
    .send({ status: 'IN_PROGRESS' });
  expect(started.status).toBe(200);

  return opened.body.data;
}

/** O técnico pergunta algo ao solicitante, e simulamos que a pergunta foi feita há algumas horas. */
async function waitingFor(ticketId: string, hours: number) {
  const response = await request(app)
    .patch(`/api/tickets/${ticketId}`)
    .set(await authHeader('agent@test.example'))
    .send({ status: 'WAITING_REQUESTER' });

  expect(response.status).toBe(200);
  await prisma.ticket.update({ where: { id: ticketId }, data: { waitingSince: new Date(Date.now() - hours * HOUR) } });
  return response.body.data;
}

/** Quanto o prazo andou para a frente, em milissegundos. */
const shift = (before: string, after: string) => Date.parse(after) - Date.parse(before);

describe('SLA pausado enquanto o chamado aguarda o solicitante', () => {
  it('a pausa começa ao aguardar o solicitante, e o prazo anda o tempo parado na volta ao atendimento', async () => {
    const ticket = await ticketInProgress();

    const waiting = await waitingFor(ticket.id, 3);
    const resumed = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(await authHeader('agent@test.example'))
      .send({ status: 'IN_PROGRESS' });

    expect(waiting.waitingSince).not.toBeNull();
    expect(waiting.dueAt).toBe(ticket.dueAt);
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.waitingSince).toBeNull();
    expect(shift(ticket.dueAt, resumed.body.data.dueAt)).toBeGreaterThanOrEqual(3 * HOUR);
    expect(shift(ticket.dueAt, resumed.body.data.dueAt)).toBeLessThan(3 * HOUR + 60_000);
  });

  it('a resposta do solicitante também retoma o relógio', async () => {
    const ticket = await ticketInProgress();
    await waitingFor(ticket.id, 2);

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(await authHeader('ana@test.example'))
      .send({ body: 'Pode vir amanhã às 10h.' });
    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(await authHeader('agent@test.example'));

    expect(after.body.data.status).toBe('IN_PROGRESS');
    expect(after.body.data.waitingSince).toBeNull();
    expect(shift(ticket.dueAt, after.body.data.dueAt)).toBeGreaterThanOrEqual(2 * HOUR);
    expect(shift(ticket.dueAt, after.body.data.dueAt)).toBeLessThan(2 * HOUR + 60_000);
  });

  it('comentário da equipe e nota interna não retomam o relógio', async () => {
    const agent = await authHeader('agent@test.example');
    const ticket = await ticketInProgress();
    await waitingFor(ticket.id, 2);
    const before = await request(app).get(`/api/tickets/${ticket.id}`).set(agent);

    await request(app).post(`/api/tickets/${ticket.id}/comments`).set(agent).send({ body: 'Aguardando a sua resposta.' });
    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(agent)
      .send({ body: 'Fornecedor só atende à tarde.', isInternal: true });
    const after = await request(app).get(`/api/tickets/${ticket.id}`).set(agent);

    expect(after.body.data.status).toBe('WAITING_REQUESTER');
    expect(after.body.data.waitingSince).toBe(before.body.data.waitingSince);
    expect(after.body.data.dueAt).toBe(before.body.data.dueAt);
  });

  it('pausas seguidas se somam', async () => {
    const agent = await authHeader('agent@test.example');
    const ticket = await ticketInProgress();

    await waitingFor(ticket.id, 2);
    await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'IN_PROGRESS' });
    await waitingFor(ticket.id, 3);
    const resumed = await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'IN_PROGRESS' });

    expect(shift(ticket.dueAt, resumed.body.data.dueAt)).toBeGreaterThanOrEqual(5 * HOUR);
    expect(shift(ticket.dueAt, resumed.body.data.dueAt)).toBeLessThan(5 * HOUR + 60_000);
  });

  it('trocar a prioridade não perde o tempo em que o chamado ficou pausado', async () => {
    const agent = await authHeader('agent@test.example');
    const ticket = await ticketInProgress();
    await waitingFor(ticket.id, 3);
    await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'IN_PROGRESS' });

    const response = await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ priority: 'HIGH' });

    // Alta: 8 h desde a abertura, mais as 3 h de pausa.
    const expected = Date.parse(ticket.createdAt) + 8 * HOUR + 3 * HOUR;
    expect(Date.parse(response.body.data.dueAt) - expected).toBeGreaterThanOrEqual(0);
    expect(Date.parse(response.body.data.dueAt) - expected).toBeLessThan(60_000);
  });

  it('trocar a prioridade na mesma alteração que encerra a espera soma a pausa ao prazo novo', async () => {
    const ticket = await ticketInProgress();
    await waitingFor(ticket.id, 3);

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(await authHeader('agent@test.example'))
      .send({ status: 'IN_PROGRESS', priority: 'HIGH' });

    // Alta: 8 h desde a abertura, mais as 3 h de pausa.
    const expected = Date.parse(ticket.createdAt) + 8 * HOUR + 3 * HOUR;
    expect(Date.parse(response.body.data.dueAt) - expected).toBeGreaterThanOrEqual(0);
    expect(Date.parse(response.body.data.dueAt) - expected).toBeLessThan(60_000);
  });

  it('resolver direto da espera desconta a pausa no cumprimento do SLA', async () => {
    const now = Date.now();
    // Venceria há 6 h, mas aguarda o solicitante há 26 h: parou com 20 h de folga.
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Aguardando resposta',
        description: 'Descrição de teste.',
        categoryId: data.category.id,
        requesterId: data.ana.id,
        status: 'WAITING_REQUESTER',
        createdAt: new Date(now - 30 * HOUR),
        dueAt: new Date(now - 6 * HOUR),
        waitingSince: new Date(now - 26 * HOUR),
      },
    });
    const agent = await authHeader('agent@test.example');

    const resolved = await request(app).patch(`/api/tickets/${ticket.id}`).set(agent).send({ status: 'RESOLVED' });
    const dashboard = await request(app).get('/api/dashboard').set(agent);

    expect(resolved.status).toBe(200);
    expect(resolved.body.data.waitingSince).toBeNull();
    expect(shift(ticket.dueAt.toISOString(), resolved.body.data.dueAt)).toBeGreaterThanOrEqual(26 * HOUR);
    expect(dashboard.body.data.sla.compliancePercent).toBe(100);
  });

  it('parado antes de vencer, o chamado não conta como atrasado; parado depois, continua atrasado', async () => {
    const now = Date.now();
    const base = {
      description: 'Descrição de teste.',
      categoryId: data.category.id,
      requesterId: data.ana.id,
      status: 'WAITING_REQUESTER' as const,
      createdAt: new Date(now - 30 * HOUR),
      dueAt: new Date(now - 6 * HOUR), // venceria há 6 h, se o relógio não tivesse parado
    };
    await prisma.ticket.createMany({
      data: [
        { ...base, title: 'Parado antes de vencer', waitingSince: new Date(now - 26 * HOUR) },
        { ...base, title: 'Parado depois de vencer', waitingSince: new Date(now - HOUR) },
      ],
    });
    const agent = await authHeader('agent@test.example');

    const overdue = await request(app).get('/api/tickets').query({ overdue: true }).set(agent);
    const onTime = await request(app).get('/api/tickets').query({ overdue: false }).set(agent);
    const dashboard = await request(app).get('/api/dashboard').set(agent);

    expect(overdue.body.data.map((ticket: { title: string }) => ticket.title)).toEqual(['Parado depois de vencer']);
    expect(onTime.body.data.map((ticket: { title: string; isOverdue: boolean }) => [ticket.title, ticket.isOverdue])).toEqual([
      ['Parado antes de vencer', false],
    ]);
    expect(dashboard.body.data.summary.overdue).toBe(1);
  });
});
