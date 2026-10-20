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

  it('um admin rebaixado não usa o token antigo para se promover de novo', async () => {
    const oldToken = await authHeader('admin@test.example');
    await prisma.user.update({ where: { id: data.admin.id }, data: { role: 'AGENT' } });

    const response = await request(app).patch(`/api/users/${data.admin.id}`).set(oldToken).send({ role: 'ADMIN' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.admin.id } });

    expect(response.status).toBe(403);
    expect(stored.role).toBe('AGENT');
  });
});
