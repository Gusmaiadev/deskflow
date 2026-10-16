import type { CookieOptions, Request, Response } from 'express';
import { isProduction } from '../../config/env.js';

export const REFRESH_COOKIE_NAME = 'deskflow_refresh';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true, // o JavaScript da página não consegue ler (protege contra XSS)
  secure: isProduction, // em produção, só trafega por HTTPS
  sameSite: 'strict', // nunca é enviado por requisições vindas de outros sites (protege contra CSRF)
  path: '/api/auth', // só é enviado para as rotas de autenticação
};

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...refreshCookieOptions, expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
}

export function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
