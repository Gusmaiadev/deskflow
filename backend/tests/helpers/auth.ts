import request from 'supertest';
import { app } from '../../src/app.js';
import { TEST_PASSWORD } from './database.js';

/** Faz login pela API e devolve o header Authorization pronto para usar. */
export async function authHeader(email: string): Promise<{ Authorization: string }> {
  const response = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });

  if (response.status !== 200) {
    throw new Error(`Login de teste falhou para ${email}: status ${response.status}`);
  }

  return { Authorization: `Bearer ${response.body.data.accessToken}` };
}
