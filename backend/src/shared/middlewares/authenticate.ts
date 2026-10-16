import type { Request, RequestHandler } from 'express';
import { verifyAccessToken, type AccessTokenUser } from '../../modules/auth/access-token.js';
import { UnauthorizedError } from '../errors/app-error.js';

/** Autenticação: descobre QUEM está fazendo a requisição, a partir do token de acesso. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Envie o token de acesso no cabeçalho Authorization.', 'MISSING_TOKEN');
  }

  req.user = await verifyAccessToken(token);
  next();
};

/** Devolve o usuário autenticado. Use apenas em rotas protegidas por "authenticate". */
export function getAuthUser(req: Request): AccessTokenUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
