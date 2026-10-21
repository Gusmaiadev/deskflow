import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { ForbiddenError } from '../errors/app-error.js';

/** Header que o CloudFront acrescenta a toda requisição que encaminha para a API. */
export const ORIGIN_SECRET_HEADER = 'x-origin-verify';

/** Compara em tempo constante, para o tempo de resposta não revelar o segredo aos poucos. */
function matches(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Recusa requisições que não passaram pelo CloudFront.
 * Sem segredo configurado (desenvolvimento e testes), deixa tudo passar.
 */
export function requireOriginSecret(secret: string | undefined): RequestHandler {
  return (req, _res, next) => {
    if (secret === undefined) {
      next();
      return;
    }

    const received = req.get(ORIGIN_SECRET_HEADER);

    if (!received || !matches(received, secret)) {
      throw new ForbiddenError('Acesso direto à API não é permitido.', 'DIRECT_ORIGIN_ACCESS');
    }

    next();
  };
}
