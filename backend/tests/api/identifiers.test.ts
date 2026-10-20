import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

describe('ids enviados em maiúsculas', () => {
  it('renomear uma categoria mudando só as maiúsculas não acusa nome repetido', async () => {
    const response = await request(app)
      .patch(`/api/categories/${data.category.id.toUpperCase()}`)
      .set(await authHeader('admin@test.example'))
      .send({ name: 'HARDWARE' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: data.category.id, name: 'HARDWARE' });
  });

  it('reenviar a mesma categoria e o mesmo responsável não altera o chamado', async () => {
    const agent = await authHeader('agent@test.example');
    const opened = await request(app)
      .post('/api/tickets')
      .set(await authHeader('ana@test.example'))
      .send({ title: 'Teclado não funciona', description: 'Nenhuma tecla responde desde hoje cedo.', categoryId: data.category.id });
    const started = await request(app).patch(`/api/tickets/${opened.body.data.id}`).set(agent).send({ status: 'IN_PROGRESS' });
    expect(started.body.data.assignee).toEqual({ id: data.agent.id, name: 'Técnico Teste' });

    const response = await request(app)
      .patch(`/api/tickets/${opened.body.data.id.toUpperCase()}`)
      .set(agent)
      .send({ categoryId: data.category.id.toUpperCase(), assigneeId: data.agent.id.toUpperCase() });

    expect(response.status).toBe(200);
    expect(response.body.data.updatedAt).toBe(started.body.data.updatedAt);
  });
});
