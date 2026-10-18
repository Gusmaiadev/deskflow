import { randomUUID } from 'node:crypto';
import type { User } from '../../generated/prisma/client.js';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error.js';
import { toPublicUser, type PublicUser } from '../users/users.mapper.js';
import * as usersRepository from '../users/users.repository.js';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from './access-token.js';
import type { ChangePasswordInput, LoginInput } from './auth.schemas.js';
import { getDummyHash, hashPassword, needsRehash, verifyPassword } from './password.js';
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiresAt } from './refresh-token.js';
import * as refreshTokensRepository from './refresh-tokens.repository.js';

export type Session = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PublicUser;
};

const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';
const SESSION_EXPIRED = 'Sua sessão expirou. Faça login novamente.';

function sessionExpired(): UnauthorizedError {
  return new UnauthorizedError(SESSION_EXPIRED, 'SESSION_EXPIRED');
}

async function buildSession(user: User, refreshToken: string, expiresAt: Date): Promise<Session> {
  return {
    accessToken: await signAccessToken(user),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
    user: toPublicUser(user),
  };
}

export async function login(input: LoginInput): Promise<Session> {
  const user = await usersRepository.findByEmail(input.email);

  if (!user) {
    // Mesmo trabalho de um login real, para o tempo de resposta não revelar
    // quais e-mails estão cadastrados.
    await verifyPassword(await getDummyHash(), input.password);
    throw new UnauthorizedError(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await verifyPassword(user.passwordHash, input.password);

  if (!passwordMatches || !user.isActive) {
    throw new UnauthorizedError(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }

  // Se os parâmetros do hash mudaram (como do seed do Dia 2 para hoje),
  // aproveitamos que temos a senha em mãos para refazer o hash.
  if (needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(input.password);
    // Só grava se o hash ainda for o que conferimos: o rehash nunca desfaz uma troca de senha.
    await usersRepository.updatePasswordHashIfUnchanged(user.id, user.passwordHash, newHash);
  }

  await refreshTokensRepository.deleteExpiredForUser(user.id);

  const { token, tokenHash } = generateRefreshToken();
  const expiresAt = refreshTokenExpiresAt();

  await refreshTokensRepository.create({
    userId: user.id,
    familyId: randomUUID(), // cada login inicia uma nova "família" de tokens
    tokenHash,
    expiresAt,
  });

  return buildSession(user, token, expiresAt);
}

export async function refresh(rawToken: string | undefined): Promise<Session> {
  if (!rawToken) throw sessionExpired();

  const stored = await refreshTokensRepository.findByHash(hashRefreshToken(rawToken));

  if (!stored) throw sessionExpired();

  if (stored.revokedAt) {
    // Um token já trocado foi usado de novo: alguém pode ter roubado o cookie.
    // Por segurança, encerramos a sessão inteira (atacante e usuário legítimo).
    await refreshTokensRepository.revokeFamily(stored.familyId);
    console.warn(`⚠️ Reuso de refresh token detectado (usuário ${stored.userId}). Sessão encerrada.`);
    throw sessionExpired();
  }

  if (stored.expiresAt <= new Date() || !stored.user.isActive) {
    await refreshTokensRepository.revokeFamily(stored.familyId);
    throw sessionExpired();
  }

  const { token, tokenHash } = generateRefreshToken();
  const expiresAt = refreshTokenExpiresAt();

  const rotated = await refreshTokensRepository.rotate(stored.id, {
    userId: stored.userId,
    familyId: stored.familyId,
    tokenHash,
    expiresAt,
  });

  if (!rotated) {
    // Outra requisição usou este mesmo token no mesmo instante: tratamos como reuso.
    await refreshTokensRepository.revokeFamily(stored.familyId);
    console.warn(`⚠️ Uso simultâneo de refresh token (usuário ${stored.userId}). Sessão encerrada.`);
    throw sessionExpired();
  }

  return buildSession(stored.user, token, expiresAt);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;

  const stored = await refreshTokensRepository.findByHash(hashRefreshToken(rawToken));

  if (stored) {
    await refreshTokensRepository.revokeFamily(stored.familyId);
  }
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await usersRepository.findById(userId);

  if (!user || !user.isActive) throw sessionExpired();

  return toPublicUser(user);
}

/**
 * Troca a senha do próprio usuário, conferindo a atual, e encerra as OUTRAS sessões.
 * A sessão do refresh token informado (a deste dispositivo) continua; sem ele, todas terminam.
 * Limites, como os do modelo de dois tokens: um access token já emitido vale até expirar, e um
 * login ou uma renovação em andamento no mesmo instante da troca pode escapar da revogação.
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  rawToken: string | undefined,
): Promise<void> {
  const user = await usersRepository.findById(userId);

  if (!user || !user.isActive) throw sessionExpired();

  const passwordMatches = await verifyPassword(user.passwordHash, input.currentPassword);

  if (!passwordMatches) {
    throw new BadRequestError('A senha atual está incorreta.', 'INVALID_CURRENT_PASSWORD');
  }

  // Só grava se a senha não mudou desde a conferência: em duas trocas simultâneas, vale a primeira.
  const { count } = await usersRepository.updatePasswordHashIfUnchanged(
    user.id,
    user.passwordHash,
    await hashPassword(input.newPassword),
  );

  if (count === 0) {
    throw new BadRequestError('A senha atual está incorreta.', 'INVALID_CURRENT_PASSWORD');
  }

  const stored = rawToken ? await refreshTokensRepository.findByHash(hashRefreshToken(rawToken)) : null;
  const keepsCurrentSession = stored !== null && stored.userId === user.id && !stored.revokedAt;

  if (keepsCurrentSession) {
    await refreshTokensRepository.revokeOtherFamiliesForUser(user.id, stored.familyId);
  } else {
    await refreshTokensRepository.revokeAllForUser(user.id);
  }
}
