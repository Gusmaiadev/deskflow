import request, { type Response } from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, TEST_PASSWORD, type TestData } from '../helpers/database.js';
import { whileAnotherRequestWrites } from '../helpers/locks.js';

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

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

/** Cria um usuário pela API, como o admin. */
async function createUser(body: Record<string, unknown>) {
  return request(app).post('/api/users').set(await authHeader('admin@test.example')).send(body);
}

/** Altera um usuário pela API, como o admin. */
async function updateUser(userId: string, body: Record<string, unknown>) {
  return request(app).patch(`/api/users/${userId}`).set(await authHeader('admin@test.example')).send(body);
}

describe('GET /api/users', () => {
  it('o admin vê todos os usuários em ordem de nome, inclusive os desativados, e sem o hash da senha', async () => {
    // A tela de administração mostra os desativados, para que possam ser reativados.
    await prisma.user.update({ where: { id: data.bruno.id }, data: { isActive: false } });

    const response = await request(app).get('/api/users').set(await authHeader('admin@test.example'));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject([
      { name: 'Admin Teste', role: 'ADMIN', isActive: true },
      { name: 'Ana Teste', role: 'REQUESTER', isActive: true },
      { name: 'Bruno Teste', role: 'REQUESTER', isActive: false },
      { name: 'Técnico Teste', role: 'AGENT', isActive: true },
    ]);
    for (const user of response.body.data) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });

  it('o técnico filtra por perfil (?role=AGENT), para atribuir chamados', async () => {
    const response = await request(app)
      .get('/api/users')
      .query({ role: 'AGENT' })
      .set(await authHeader('agent@test.example'));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject([{ id: data.agent.id, name: 'Técnico Teste', role: 'AGENT' }]);
  });

  it('é restrito à equipe de suporte', async () => {
    const response = await request(app).get('/api/users').set(await authHeader('ana@test.example'));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/users/:id', () => {
  it('o admin vê os dados públicos de um usuário', async () => {
    const response = await request(app).get(`/api/users/${data.ana.id}`).set(await authHeader('admin@test.example'));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: data.ana.id, email: 'ana@test.example', role: 'REQUESTER' });
    expect(response.body.data).not.toHaveProperty('passwordHash');
  });

  it('é restrito ao admin', async () => {
    const response = await request(app).get(`/api/users/${data.ana.id}`).set(await authHeader('agent@test.example'));

    expect(response.status).toBe(403);
  });

  it('responde 404 para um usuário que não existe e 400 para um id inválido', async () => {
    const admin = await authHeader('admin@test.example');

    const unknown = await request(app).get('/api/users/01a0f3af-7c12-75ae-9d42-d46c05d373b0').set(admin);
    const invalid = await request(app).get('/api/users/123').set(admin);

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('USER_NOT_FOUND');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details).toEqual([{ field: 'id', message: 'Identificador de usuário inválido.' }]);
  });
});

describe('POST /api/users', () => {
  it('o admin cria um usuário que já consegue entrar, e a senha fica guardada só como hash', async () => {
    const carla = { name: 'Carla Dias', email: 'carla@test.example', password: 'senha-da-carla-123', role: 'AGENT' };

    const response = await createUser(carla);
    const stored = await prisma.user.findUnique({ where: { email: carla.email } });
    const carlaLogin = await login(carla.email, carla.password);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ name: carla.name, email: carla.email, role: 'AGENT', isActive: true });
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(carlaLogin.status).toBe(200);
    expect(carlaLogin.body.data.user).toMatchObject({ id: response.body.data.id, role: 'AGENT' });
  });

  it('recusa um e-mail já cadastrado, mesmo escrito com outras maiúsculas', async () => {
    const response = await createUser({ name: 'Outra Ana', email: 'ANA@Test.Example', password: 'senha-forte-123' });
    const users = await prisma.user.count();

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_IN_USE');
    expect(users).toBe(4);
  });

  it('ignora campos fora do cadastro: o usuário novo é solicitante, ativo e entra com a senha enviada', async () => {
    // Sem o perfil, e com dois campos que o cadastro não aceita.
    const carla = { name: 'Carla Dias', email: 'carla@test.example', password: 'senha-da-carla-123' };

    const response = await createUser({ ...carla, passwordHash: 'hackeado', isActive: false });
    const carlaLogin = await login(carla.email, carla.password);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ role: 'REQUESTER', isActive: true });
    expect(carlaLogin.status).toBe(200);
  });

  it('duas criações simultâneas com o mesmo e-mail: o banco aceita só uma, e a outra recebe 409', async () => {
    const admin = await authHeader('admin@test.example');
    const carla = { name: 'Carla Dias', email: 'carla@test.example', password: 'senha-da-carla-123' };

    // A outra criação ainda não foi confirmada quando o service confere o e-mail: quem recusa é a constraint UNIQUE.
    const response = await whileAnotherRequestWrites(
      (tx) => tx.user.create({ data: { name: carla.name, email: carla.email, passwordHash: 'hash-qualquer' } }),
      () => request(app).post('/api/users').set(admin).send(carla),
    );
    const created = await prisma.user.count({ where: { email: carla.email } });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(created).toBe(1);
  });
});

describe('PATCH /api/users/:id', () => {
  it('responde 404 para um usuário que não existe', async () => {
    const response = await updateUser('01a0f3af-7c12-75ae-9d42-d46c05d373b0', { isActive: false });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('sessões de quem tem o acesso alterado', () => {
  it('desativar recusa o login e a renovação da sessão do usuário', async () => {
    const session = await login('agent@test.example');

    const response = await updateUser(data.agent.id, { isActive: false });
    const renewal = await refresh(sessionCookie(session));
    const newLogin = await login('agent@test.example');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: data.agent.id, isActive: false });
    expect(renewal.status).toBe(401);
    expect(renewal.body.error.code).toBe('SESSION_EXPIRED');
    expect(newLogin.status).toBe(401);
    expect(newLogin.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('reativar não devolve as sessões encerradas na desativação: é preciso entrar de novo', async () => {
    const session = await login('agent@test.example');

    const deactivate = await updateUser(data.agent.id, { isActive: false });
    const reactivate = await updateUser(data.agent.id, { isActive: true });
    const renewal = await refresh(sessionCookie(session));
    const newLogin = await login('agent@test.example');

    expect(deactivate.status).toBe(200);
    expect(reactivate.status).toBe(200);
    expect(renewal.status).toBe(401);
    expect(renewal.body.error.code).toBe('SESSION_EXPIRED');
    expect(newLogin.status).toBe(200);
  });

  it('trocar o perfil encerra as sessões em todos os dispositivos; o novo login já traz o perfil novo', async () => {
    const firstDevice = await login('agent@test.example');
    const secondDevice = await login('agent@test.example');
    const otherPerson = await login('ana@test.example');

    const response = await updateUser(data.agent.id, { role: 'REQUESTER' });
    const firstDeviceRefresh = await refresh(sessionCookie(firstDevice));
    const secondDeviceRefresh = await refresh(sessionCookie(secondDevice));
    const otherPersonRefresh = await refresh(sessionCookie(otherPerson));
    const newLogin = await login('agent@test.example');

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('REQUESTER');
    expect(firstDeviceRefresh.status).toBe(401);
    expect(firstDeviceRefresh.body.error.code).toBe('SESSION_EXPIRED');
    expect(secondDeviceRefresh.status).toBe(401);
    expect(secondDeviceRefresh.body.error.code).toBe('SESSION_EXPIRED');
    expect(otherPersonRefresh.status).toBe(200);
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.user.role).toBe('REQUESTER');
  });

  it('renomear, ou reenviar o perfil e o status atuais, não encerra as sessões', async () => {
    const session = await login('agent@test.example');

    const rename = await updateUser(data.agent.id, { name: 'Técnico Renomeado' });
    const afterRename = await refresh(sessionCookie(session));
    // Um formulário de edição pode reenviar os campos que não mudaram.
    const sameAccess = await updateUser(data.agent.id, { role: 'AGENT', isActive: true });
    const afterSameAccess = await refresh(sessionCookie(afterRename));

    expect(rename.status).toBe(200);
    expect(afterRename.status).toBe(200);
    expect(afterRename.body.data.user.name).toBe('Técnico Renomeado');
    expect(sameAccess.status).toBe(200);
    expect(afterSameAccess.status).toBe(200);
  });
});

describe('proteções da gestão de usuários', () => {
  it('o admin não remove o próprio acesso, nem enviando o id em maiúsculas', async () => {
    const admin = await authHeader('admin@test.example');
    const upperCaseId = data.admin.id.toUpperCase();

    const deactivate = await request(app).patch(`/api/users/${upperCaseId}`).set(admin).send({ isActive: false });
    const demote = await request(app).patch(`/api/users/${upperCaseId}`).set(admin).send({ role: 'AGENT' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.admin.id } });

    expect(deactivate.status).toBe(400);
    expect(deactivate.body.error.code).toBe('SELF_LOCKOUT');
    expect(demote.status).toBe(400);
    expect(demote.body.error.code).toBe('SELF_LOCKOUT');
    expect(stored).toMatchObject({ isActive: true, role: 'ADMIN' });
  });

  it('um admin desativado não usa o token antigo para se reativar nem para criar outro admin', async () => {
    const oldToken = await authHeader('admin@test.example');
    await prisma.user.update({ where: { id: data.admin.id }, data: { isActive: false } });

    const reactivate = await request(app).patch(`/api/users/${data.admin.id}`).set(oldToken).send({ isActive: true });
    const create = await request(app)
      .post('/api/users')
      .set(oldToken)
      .send({ name: 'Novo Admin', email: 'novo@test.example', password: 'senha-forte-123', role: 'ADMIN' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.admin.id } });
    const created = await prisma.user.count({ where: { email: 'novo@test.example' } });

    expect(reactivate.status).toBe(403);
    expect(create.status).toBe(403);
    expect(stored.isActive).toBe(false);
    expect(created).toBe(0);
  });

  it('as contas de demonstração não são desativadas, rebaixadas nem renomeadas, e as sessões continuam', async () => {
    // Conta pública da demo, criada direto no banco como admin (como a Marina em produção).
    const demo = await prisma.user.create({
      data: { name: 'Demo Teste', email: 'demo@test.example', role: 'ADMIN', passwordHash: await hashPassword(TEST_PASSWORD) },
    });
    const session = await login('demo@test.example');

    const deactivate = await updateUser(demo.id, { isActive: false });
    const demote = await updateUser(demo.id, { role: 'REQUESTER' });
    const rename = await updateUser(demo.id, { name: 'Outro Nome' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: demo.id } });
    const renewal = await refresh(sessionCookie(session));

    for (const response of [deactivate, demote, rename]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('DEMO_ACCOUNT');
    }
    expect(stored).toMatchObject({ name: 'Demo Teste', role: 'ADMIN', isActive: true });
    expect(renewal.status).toBe(200);
  });

  it('um admin rebaixado não usa o token antigo para se promover de novo', async () => {
    const oldToken = await authHeader('admin@test.example');
    await prisma.user.update({ where: { id: data.admin.id }, data: { role: 'AGENT' } });

    const response = await request(app).patch(`/api/users/${data.admin.id}`).set(oldToken).send({ role: 'ADMIN' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.admin.id } });

    expect(response.status).toBe(403);
    expect(stored.role).toBe('AGENT');
  });
});
