import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData } from '../helpers/database.js';

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

afterAll(disconnectDatabase);

describe('requisições malformadas', () => {
  it('um %XX inválido na URL responde 400, e não 500', async () => {
    const response = await request(app).get('/api/users/%E0%A4%A').set(await authHeader('admin@test.example'));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('um charset que a API não sabe ler responde 415, e não 500', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{"email":"ana@test.example","password":"x"}');

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });
});
