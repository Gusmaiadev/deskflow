import request, { type Response } from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { disconnectDatabase, resetDatabase, seedTestData, TEST_PASSWORD } from '../helpers/database.js';

/** O par "nome=valor" do cookie de sessão, como o navegador o enviaria de volta. */
function sessionCookie(response: Response): string {
  const header = response.get('Set-Cookie')?.[0] ?? '';
  return header.split(';')[0] ?? '';
}

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

afterAll(disconnectDatabase);

describe('POST /api/auth/login', () => {
  it('devolve o access token e grava o refresh token num cookie protegido', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: '  ANA@test.example ', password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ email: 'ana@test.example', role: 'REQUESTER' });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const cookie = response.get('Set-Cookie')?.[0] ?? '';
    expect(cookie).toContain('deskflow_refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth');
  });

  it('responde igual para senha errada e para e-mail inexistente', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@test.example', password: 'senha-errada-1' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@test.example', password: 'senha-errada-1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe('POST /api/auth/refresh', () => {
  it('troca o cookie a cada uso e encerra a sessão quando um cookie antigo é reutilizado', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'ana@test.example', password: TEST_PASSWORD });
    const firstCookie = sessionCookie(login);

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    const secondCookie = sessionCookie(refreshed);

    expect(refreshed.status).toBe(200);
    expect(secondCookie).not.toBe(firstCookie);

    const reused = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(reused.status).toBe(401);

    // A família inteira foi encerrada: nem o cookie mais novo funciona.
    const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', secondCookie);
    expect(afterReuse.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('exige o token de acesso', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.get('WWW-Authenticate')).toBe('Bearer');
    expect(response.body.error.code).toBe('MISSING_TOKEN');
  });
});
