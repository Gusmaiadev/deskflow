import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Limite absoluto de uma sessão: mesmo renovando sempre, depois disso é preciso fazer login de novo. */
export const SESSION_MAX_AGE_DAYS = 30;

/** Token opaco: 32 bytes aleatórios (256 bits). No banco guardamos só o hash dele. */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

/** SHA-256 basta aqui: o token é aleatório e longo, então não há o que adivinhar. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + env.REFRESH_TOKEN_TTL_DAYS * DAY_IN_MS);
}

export function sessionMaxAgeReached(startedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - startedAt.getTime() >= SESSION_MAX_AGE_DAYS * DAY_IN_MS;
}
