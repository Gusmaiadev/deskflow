import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/shared/middlewares/error-handler.js';
import { requireOriginSecret } from '../../src/shared/middlewares/origin-guard.js';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';

/** Um app mínimo, só com o middleware em teste e uma rota qualquer. */
function buildApp(secret: string | undefined) {
  const app = express();
  app.use(requireOriginSecret(secret));
  app.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('requireOriginSecret', () => {
  it('recusa a requisição que não passou pelo CloudFront', async () => {
    const response = await request(buildApp(SECRET)).get('/ping');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('DIRECT_ORIGIN_ACCESS');
  });

  it('recusa um segredo errado', async () => {
    const response = await request(buildApp(SECRET)).get('/ping').set('X-Origin-Verify', 'chute');

    expect(response.status).toBe(403);
  });

  it('aceita a requisição com o segredo certo', async () => {
    const response = await request(buildApp(SECRET)).get('/ping').set('X-Origin-Verify', SECRET);

    expect(response.status).toBe(200);
  });

  it('sem segredo configurado, não bloqueia nada', async () => {
    const response = await request(buildApp(undefined)).get('/ping');

    expect(response.status).toBe(200);
  });
});
