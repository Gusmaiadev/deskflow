import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error.js';
import { hashPassword } from '../auth/password.js';
import * as refreshTokensRepository from '../auth/refresh-tokens.repository.js';
import { toPublicUser, type PublicUser } from './users.mapper.js';
import * as usersRepository from './users.repository.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schemas.js';

export async function listUsers(filters: ListUsersQuery): Promise<PublicUser[]> {
  const users = await usersRepository.list(filters);
  return users.map(toPublicUser);
}

export async function getUser(userId: string): Promise<PublicUser> {
  const user = await usersRepository.findById(userId);

  if (!user) {
    throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');
  }

  return toPublicUser(user);
}

/**
 * O perfil do token pode estar desatualizado por até 15 minutos (a "janela" do JWT).
 * Para criar ou alterar usuários, conferimos no banco que quem age ainda é um admin ativo:
 * assim, um admin rebaixado ou desativado não usa o token antigo para se restaurar.
 */
async function ensureActiveAdmin(actorId: string): Promise<void> {
  const actor = await usersRepository.findById(actorId);

  if (!actor || !actor.isActive || actor.role !== 'ADMIN') {
    throw new ForbiddenError();
  }
}

export async function createUser(actorId: string, input: CreateUserInput): Promise<PublicUser> {
  await ensureActiveAdmin(actorId);

  const existing = await usersRepository.findByEmail(input.email);

  if (existing) {
    throw new ConflictError('Já existe um usuário com este e-mail.', 'EMAIL_IN_USE');
  }

  const user = await usersRepository.create({
    name: input.name,
    email: input.email,
    role: input.role,
    passwordHash: await hashPassword(input.password),
  });

  return toPublicUser(user);
}

export async function updateUser(
  actorId: string,
  userId: string,
  input: UpdateUserInput,
): Promise<PublicUser> {
  await ensureActiveAdmin(actorId);

  const removesOwnAdminAccess =
    actorId === userId && (input.isActive === false || (input.role !== undefined && input.role !== 'ADMIN'));

  if (removesOwnAdminAccess) {
    throw new BadRequestError('Você não pode remover o seu próprio acesso de administrador.', 'SELF_LOCKOUT');
  }

  const current = await usersRepository.findById(userId);

  if (!current) {
    throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');
  }

  // A demo dá acesso de admin a qualquer visitante: as contas públicas ficam como estão para o próximo.
  if (env.DEMO_ACCOUNT_EMAILS.includes(current.email)) {
    throw new ForbiddenError('As contas de demonstração não podem ser alteradas.', 'DEMO_ACCOUNT');
  }

  const updated = await usersRepository.update(userId, input);

  // Desativação ou troca de perfil: as sessões abertas precisam terminar,
  // para que o próximo token já reflita a nova situação.
  const accessChanged =
    (input.isActive === false && current.isActive) || (input.role !== undefined && input.role !== current.role);

  if (accessChanged) {
    await refreshTokensRepository.revokeAllForUser(userId);
  }

  return toPublicUser(updated);
}
