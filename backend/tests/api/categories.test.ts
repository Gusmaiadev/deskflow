import request, { type Response } from 'supertest';
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

/** Lista as categorias pela API, como o usuário informado. */
async function listCategories(email: string) {
  return request(app).get('/api/categories').set(await authHeader(email));
}

/** Cria uma categoria pela API, como o usuário informado. */
async function createCategory(email: string, body: Record<string, unknown>) {
  return request(app).post('/api/categories').set(await authHeader(email)).send(body);
}

/** Altera uma categoria pela API, como o usuário informado. */
async function updateCategory(email: string, categoryId: string, body: Record<string, unknown>) {
  return request(app).patch(`/api/categories/${categoryId}`).set(await authHeader(email)).send(body);
}

/** Os nomes das categorias da resposta, na ordem em que vieram. */
function namesIn(response: Response): string[] {
  return response.body.data.map((category: { name: string }) => category.name);
}

describe('GET /api/categories', () => {
  it('o admin vê também as desativadas; o técnico e o solicitante, só as ativas', async () => {
    // Prepara o cenário direto no banco: além da "Hardware", ativa, uma categoria desativada.
    await prisma.category.create({ data: { name: 'Telefonia', isActive: false } });

    const asAdmin = await listCategories('admin@test.example');
    const asAgent = await listCategories('agent@test.example');
    const asAna = await listCategories('ana@test.example');

    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data).toMatchObject([
      { name: 'Hardware', isActive: true },
      { name: 'Telefonia', isActive: false },
    ]);
    expect(asAgent.status).toBe(200);
    expect(namesIn(asAgent)).toEqual(['Hardware']);
    expect(asAna.status).toBe(200);
    expect(namesIn(asAna)).toEqual(['Hardware']);
  });
});

describe('PATCH /api/categories/:id', () => {
  it('o admin desativa uma categoria sem precisar enviar o nome', async () => {
    const response = await updateCategory('admin@test.example', data.category.id, { isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: data.category.id, name: 'Hardware', isActive: false });
  });

  it('responde 404 para uma categoria que não existe e 400 para um id inválido', async () => {
    const unknownId = '01a0f3af-7c12-75ae-9d42-d46c05d373b0'; // um UUID válido, mas de nenhuma categoria

    const unknown = await updateCategory('admin@test.example', unknownId, { isActive: false });
    const invalid = await updateCategory('admin@test.example', '123', { isActive: false });

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('CATEGORY_NOT_FOUND');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details).toEqual([{ field: 'id', message: 'Identificador de categoria inválido.' }]);
  });

  it('renomear para o nome de outra categoria acusa nome repetido, mesmo com outras maiúsculas', async () => {
    const network = await prisma.category.create({ data: { name: 'Rede' } });

    // Já existe "Hardware". A descrição vai junto: a alteração inteira é recusada.
    const response = await updateCategory('admin@test.example', network.id, {
      name: 'hardware',
      description: 'Cabos e Wi-Fi',
    });
    const stored = await prisma.category.findUniqueOrThrow({ where: { id: network.id } });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CATEGORY_NAME_IN_USE');
    expect(stored).toMatchObject({ name: 'Rede', description: null });
  });
});

describe('só o admin cria e altera categorias', () => {
  it('o técnico e o solicitante recebem 403 ao criar, e nada é gravado', async () => {
    const asAgent = await createCategory('agent@test.example', { name: 'Telefonia' });
    const asAna = await createCategory('ana@test.example', { name: 'Telefonia' });
    const created = await prisma.category.count({ where: { name: 'Telefonia' } });

    expect(asAgent.status).toBe(403);
    expect(asAgent.body.error.code).toBe('FORBIDDEN');
    expect(asAna.status).toBe(403);
    expect(asAna.body.error.code).toBe('FORBIDDEN');
    expect(created).toBe(0);
  });

  it('o técnico e o solicitante recebem 403 ao alterar, e nada é gravado', async () => {
    const change = { name: 'Periféricos', isActive: false };

    const asAgent = await updateCategory('agent@test.example', data.category.id, change);
    const asAna = await updateCategory('ana@test.example', data.category.id, change);
    const stored = await prisma.category.findUniqueOrThrow({ where: { id: data.category.id } });

    expect(asAgent.status).toBe(403);
    expect(asAgent.body.error.code).toBe('FORBIDDEN');
    expect(asAna.status).toBe(403);
    expect(asAna.body.error.code).toBe('FORBIDDEN');
    expect(stored).toMatchObject({ name: 'Hardware', isActive: true });
  });
});
