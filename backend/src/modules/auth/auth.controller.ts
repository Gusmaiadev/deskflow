import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/authenticate.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookies.js';
import { changePasswordSchema, loginSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import type { Session } from './auth.service.js';

/** O refresh token vai no cookie; o corpo da resposta leva só o que o frontend usa. */
function toSessionResponse(session: Session) {
  return {
    accessToken: session.accessToken,
    tokenType: 'Bearer',
    expiresIn: session.expiresIn,
    user: session.user,
  };
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const session = await authService.login(input);

  setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
  res.json({ data: toSessionResponse(session) });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const session = await authService.refresh(readRefreshCookie(req));

    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    res.json({ data: toSessionResponse(session) });
  } catch (error) {
    // Cookie inválido não deve continuar no navegador.
    clearRefreshCookie(res);
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));

  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  const { id } = getAuthUser(req);
  const user = await authService.getCurrentUser(id);

  res.json({ data: user });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const input = changePasswordSchema.parse(req.body);
  const { id } = getAuthUser(req);

  await authService.changePassword(id, input, readRefreshCookie(req));

  res.status(204).end();
}
