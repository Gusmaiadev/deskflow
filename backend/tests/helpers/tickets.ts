import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { authHeader } from './auth.js';

const HOUR_IN_MS = 60 * 60 * 1000;

/** Abre um chamado de prioridade média (24 h de SLA) como a Ana, e o técnico começa o atendimento. */
export async function ticketInProgress(categoryId: string) {
  const opened = await request(app)
    .post('/api/tickets')
    .set(await authHeader('ana@test.example'))
    .send({ title: 'Monitor piscando', description: 'A tela pisca a cada poucos segundos.', categoryId });

  if (opened.status !== 201) {
    throw new Error(`Abertura do chamado de teste falhou: status ${opened.status}`);
  }

  const started = await request(app)
    .patch(`/api/tickets/${opened.body.data.id}`)
    .set(await authHeader('agent@test.example'))
    .send({ status: 'IN_PROGRESS' });

  if (started.status !== 200) {
    throw new Error(`Início do atendimento de teste falhou: status ${started.status}`);
  }

  return opened.body.data;
}

/** O técnico pergunta algo ao solicitante, e simulamos que a pergunta foi feita há algumas horas. */
export async function waitingFor(ticketId: string, hours: number) {
  const response = await request(app)
    .patch(`/api/tickets/${ticketId}`)
    .set(await authHeader('agent@test.example'))
    .send({ status: 'WAITING_REQUESTER' });

  if (response.status !== 200) {
    throw new Error(`Espera pelo solicitante de teste falhou: status ${response.status}`);
  }

  await prisma.ticket.update({ where: { id: ticketId }, data: { waitingSince: new Date(Date.now() - hours * HOUR_IN_MS) } });
  return response.body.data;
}
