import argon2 from 'argon2';
import request, { type Response } from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiresAt } from '../../src/modules/auth/refresh-token.js';
import { disconnectDatabase, resetDatabase, seedTestData, TEST_PASSWORD } from '../helpers/database.js';
import { whileAnotherRequestWrites } from '../helpers/locks.js';

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

/** Sai da sessão do cookie informado. */
function logout(cookie: string) {
  return request(app).post('/api/auth/logout').set('Cookie', cookie);
}

/** Pergunta "quem sou eu" com o access token da sessão informada. */
function me(session: Response) {
  return request(app).get('/api/auth/me').set('Authorization', `Bearer ${session.body.data.accessToken}`);
}

/** Só o valor do cookie de sessão: o refresh token, que o banco guarda como hash. */
function refreshTokenOf(session: Response): string {
  return sessionCookie(session).split('=')[1] ?? '';
}

/** Ativa ou desativa direto no banco, sem a API (que, ao desativar, já encerraria as sessões). */
function setActive(email: string, isActive: boolean) {
  return prisma.user.update({ where: { email }, data: { isActive } });
}

/** Cria a Carla com um hash da senha dos testes feito com parâmetros antigos, mais fracos que os atuais. */
async function userWithOldHash() {
  const passwordHash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id, memoryCost: 4096, timeCost: 1 });
  return prisma.user.create({ data: { name: 'Carla Teste', email: 'carla@test.example', passwordHash } });
}

/** Os parâmetros do Argon2 gravados no hash, como "m=19456,p=1,t=2" (memória, threads e iterações). */
function hashParams(passwordHash: string): string {
  return passwordHash.split('$')[3] ?? '';
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

  it('recusa a troca de um usuário desativado, mesmo com o access token ainda válido', async () => {
    const session = await login('ana@test.example');
    const deactivated = await setActive('ana@test.example', false);

    const response = await changePassword(session, { currentPassword: TEST_PASSWORD, newPassword: 'outra-senha-456' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: deactivated.id } });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');
    expect(stored.passwordHash).toBe(deactivated.passwordHash);
  });

  it('em duas trocas simultâneas vale a primeira: a outra recebe INVALID_CURRENT_PASSWORD e não grava', async () => {
    const session = await login('ana@test.example');
    const firstChangeHash = await hashPassword('senha-da-outra-troca-789');

    // A outra troca grava antes e só confirma quando esta, que conferiu a senha antiga, já espera para gravar.
    const response = await whileAnotherRequestWrites(
      (tx) => tx.user.update({ where: { email: 'ana@test.example' }, data: { passwordHash: firstChangeHash } }),
      () => changePassword(session, { currentPassword: TEST_PASSWORD, newPassword: 'outra-senha-forte-456' }),
    );
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@test.example' } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(stored.passwordHash).toBe(firstChangeHash);
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

describe('rehash da senha no login', () => {
  it('refaz com os parâmetros atuais o hash de uma senha antiga, e a mesma senha continua entrando', async () => {
    const carla = await userWithOldHash();

    const response = await login(carla.email);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: carla.id } });
    const nextLogin = await login(carla.email);

    expect(response.status).toBe(200);
    expect(hashParams(stored.passwordHash)).toBe('m=19456,p=1,t=2');
    expect(nextLogin.status).toBe(200);
  });

  it('não desfaz uma troca de senha gravada enquanto o login refazia o hash', async () => {
    const carla = await userWithOldHash();
    const changedHash = await hashPassword('senha-nova-da-carla-789');

    // A troca grava antes e só confirma quando o login, que conferiu o hash antigo, já espera para gravar o rehash.
    await whileAnotherRequestWrites(
      (tx) => tx.user.update({ where: { id: carla.id }, data: { passwordHash: changedHash } }),
      () => login(carla.email),
    );
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: carla.id } });

    expect(stored.passwordHash).toBe(changedHash);
  });
});

describe('POST /api/auth/refresh', () => {
  it('sem cookie, ou com um cookie que não existe, responde SESSION_EXPIRED e apaga o cookie', async () => {
    const withoutCookie = await request(app).post('/api/auth/refresh');
    const unknownCookie = await refresh('deskflow_refresh=cookie-que-nao-existe');

    expect(withoutCookie.status).toBe(401);
    expect(withoutCookie.body.error.code).toBe('SESSION_EXPIRED');
    expect(unknownCookie.status).toBe(401);
    expect(unknownCookie.body.error.code).toBe('SESSION_EXPIRED');
    // O cookie que não vale mais não fica no navegador: a resposta o troca por um vazio.
    expect(sessionCookie(unknownCookie)).toBe('deskflow_refresh=');
  });

  it('recusa um cookie vencido, mesmo com a sessão dentro do limite de 30 dias', async () => {
    const session = await login('ana@test.example');
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } });

    const response = await refresh(sessionCookie(session));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('de um usuário desativado encerra a sessão: reativado, o mesmo cookie continua recusado', async () => {
    const session = await login('ana@test.example');
    await setActive('ana@test.example', false);

    const whileInactive = await refresh(sessionCookie(session));
    await setActive('ana@test.example', true);
    const afterReactivation = await refresh(sessionCookie(session));

    expect(whileInactive.status).toBe(401);
    expect(whileInactive.body.error.code).toBe('SESSION_EXPIRED');
    expect(afterReactivation.status).toBe(401);
    expect(afterReactivation.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('o mesmo cookie em duas renovações simultâneas: a que perde recebe 401 e a sessão inteira termina', async () => {
    const session = await login('ana@test.example');
    const tokenHash = hashRefreshToken(refreshTokenOf(session));
    const { userId, familyId } = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash } });
    const next = generateRefreshToken();

    // A outra renovação faz a troca (como o rotate): marca o token atual como usado e cria o próximo da família.
    const response = await whileAnotherRequestWrites(
      async (tx) => {
        await tx.refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
        await tx.refreshToken.create({
          data: { userId, familyId, tokenHash: next.tokenHash, expiresAt: refreshTokenExpiresAt() },
        });
      },
      () => refresh(sessionCookie(session)),
    );
    const activeInFamily = await prisma.refreshToken.count({ where: { familyId, revokedAt: null } });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');
    // Nem o token que a outra renovação acabou de entregar continua valendo.
    expect(activeInFamily).toBe(0);
  });
});

describe('POST /api/auth/logout', () => {
  it('encerra a sessão deste dispositivo e apaga o cookie, sem derrubar as outras', async () => {
    const thisDevice = await login('ana@test.example');
    const otherDevice = await login('ana@test.example');

    const response = await logout(sessionCookie(thisDevice));
    const thisDeviceRefresh = await refresh(sessionCookie(thisDevice));
    const otherDeviceRefresh = await refresh(sessionCookie(otherDevice));

    expect(response.status).toBe(204);
    expect(sessionCookie(response)).toBe('deskflow_refresh=');
    expect(thisDeviceRefresh.status).toBe(401);
    expect(thisDeviceRefresh.body.error.code).toBe('SESSION_EXPIRED');
    expect(otherDeviceRefresh.status).toBe(200);
  });

  it('responde 204 sem erro, sem cookie ou com um cookie que não existe', async () => {
    const withoutCookie = await request(app).post('/api/auth/logout');
    const unknownCookie = await logout('deskflow_refresh=cookie-que-nao-existe');

    expect(withoutCookie.status).toBe(204);
    expect(unknownCookie.status).toBe(204);
  });
});

describe('GET /api/auth/me', () => {
  it('devolve o usuário do token, sem o hash da senha', async () => {
    const session = await login('ana@test.example');

    const response = await me(session);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(session.body.data.user.id);
    expect(response.body.data).toMatchObject({ name: 'Ana Teste', email: 'ana@test.example', role: 'REQUESTER' });
    expect(response.body.data).not.toHaveProperty('passwordHash');
  });

  it('responde SESSION_EXPIRED se o usuário foi desativado, mesmo com o access token ainda válido', async () => {
    const session = await login('ana@test.example');
    await setActive('ana@test.example', false);

    const response = await me(session);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');
  });
});
