import request, { type Response } from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { disconnectDatabase, resetDatabase, seedTestData, TEST_PASSWORD } from '../helpers/database.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** O par "nome=valor" do cookie de sessão, como o navegador o enviaria de volta. */
function sessionCookie(response: Response): string {
  const header = response.get('Set-Cookie')?.[0] ?? '';
  return header.split(';')[0] ?? '';
}

/** Faz login pela API, como um navegador faria. */
function login(email: string, password = TEST_PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password });
}

/** Renova a sessão com o cookie informado. */
function refresh(cookie: string) {
  return request(app).post('/api/auth/refresh').set('Cookie', cookie);
}

/** Troca a senha da sessão informada (access token e cookie dela). */
function changePassword(session: Response, body: { currentPassword: string; newPassword: string }) {
  return request(app)
    .patch('/api/auth/password')
    .set('Authorization', `Bearer ${session.body.data.accessToken}`)
    .set('Cookie', sessionCookie(session))
    .send(body);
}

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

afterAll(disconnectDatabase);

describe('PATCH /api/auth/password', () => {
  it('troca a senha, mantém a sessão deste dispositivo e encerra as outras', async () => {
    const thisDevice = await login('ana@test.example');
    const otherDevice = await login('ana@test.example');
    const otherPerson = await login('bruno@test.example');

    const response = await changePassword(thisDevice, { currentPassword: TEST_PASSWORD, newPassword: 'outra-senha-forte-456' });

    const thisDeviceRefresh = await refresh(sessionCookie(thisDevice));
    const otherDeviceRefresh = await refresh(sessionCookie(otherDevice));
    const otherPersonRefresh = await refresh(sessionCookie(otherPerson));
    const oldPasswordLogin = await login('ana@test.example');
    const newPasswordLogin = await login('ana@test.example', 'outra-senha-forte-456');

    expect(response.status).toBe(204);
    expect(thisDeviceRefresh.status).toBe(200);
    expect(otherDeviceRefresh.status).toBe(401);
    expect(otherPersonRefresh.status).toBe(200);
    expect(oldPasswordLogin.status).toBe(401);
    expect(newPasswordLogin.status).toBe(200);
  });

  it('com um cookie já trocado, encerra todas as sessões, inclusive a de quem o roubou', async () => {
    const victim = await login('ana@test.example');
    // Quem roubou o cookie renova primeiro; o da vítima passa a ser um cookie já trocado.
    const attacker = await refresh(sessionCookie(victim));
    expect(attacker.status).toBe(200);

    const response = await changePassword(victim, { currentPassword: TEST_PASSWORD, newPassword: 'outra-senha-forte-456' });
    const attackerRefresh = await refresh(sessionCookie(attacker));

    expect(response.status).toBe(204);
    expect(attackerRefresh.status).toBe(401);
  });

  it('recusa a senha atual errada sem mudar a senha nem as sessões', async () => {
    const thisDevice = await login('ana@test.example');
    const otherDevice = await login('ana@test.example');

    const response = await changePassword(thisDevice, { currentPassword: 'senha-errada-1', newPassword: 'outra-senha-forte-456' });

    const thisDeviceRefresh = await refresh(sessionCookie(thisDevice));
    const otherDeviceRefresh = await refresh(sessionCookie(otherDevice));
    const originalPasswordLogin = await login('ana@test.example');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(thisDeviceRefresh.status).toBe(200);
    expect(otherDeviceRefresh.status).toBe(200);
    expect(originalPasswordLogin.status).toBe(200);
  });
});

describe('limite absoluto da sessão', () => {
  it('recusa renovar uma sessão iniciada há mais de 30 dias', async () => {
    const session = await login('ana@test.example');
    expect(session.status).toBe(200);
    await prisma.refreshToken.updateMany({ data: { createdAt: new Date(Date.now() - 30 * DAY_IN_MS - 60_000) } });

    const response = await refresh(sessionCookie(session));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('a limpeza do login não "rejuvenesce" uma sessão iniciada há mais de 30 dias', async () => {
    const firstLogin = await login('ana@test.example');
    const renewed = await refresh(sessionCookie(firstLogin));
    expect(renewed.status).toBe(200);

    // O primeiro token da sessão (já trocado) passa a ser de 31 dias atrás e vencido;
    // o token atual, renovado agora, continua válido.
    await prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { createdAt: new Date(Date.now() - 31 * DAY_IN_MS), expiresAt: new Date(Date.now() - 2 * DAY_IN_MS) },
    });

    // Outro login da mesma pessoa roda a limpeza; a sessão antiga não pode "rejuvenescer".
    const anotherLogin = await login('ana@test.example');
    expect(anotherLogin.status).toBe(200);
    const response = await refresh(sessionCookie(renewed));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('renova uma sessão iniciada há menos de 30 dias, mesmo depois da limpeza do login', async () => {
    const firstLogin = await login('ana@test.example');
    const renewed = await refresh(sessionCookie(firstLogin));
    expect(renewed.status).toBe(200);

    // O primeiro token da sessão (já trocado) passa a ser de 29 dias atrás e vencido;
    // o token atual, renovado agora, continua válido.
    await prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { createdAt: new Date(Date.now() - 29 * DAY_IN_MS), expiresAt: new Date(Date.now() - 2 * DAY_IN_MS) },
    });

    // Outro login da mesma pessoa roda a limpeza; a sessão, ainda dentro dos 30 dias, continua.
    const anotherLogin = await login('ana@test.example');
    expect(anotherLogin.status).toBe(200);
    const response = await refresh(sessionCookie(renewed));

    expect(response.status).toBe(200);
  });
});
