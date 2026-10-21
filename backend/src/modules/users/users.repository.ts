import { prisma } from '../../database/prisma.js';
import type { Role } from '../../generated/prisma/client.js';

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Só id e nome: o suficiente para mostrar quem é (ex.: o responsável no histórico do chamado). */
export function findNames(ids: string[]) {
  return prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
}

export function list(filters: { role?: Role }) {
  return prisma.user.findMany({
    where: { role: filters.role },
    orderBy: { name: 'asc' },
  });
}

export function create(data: { name: string; email: string; passwordHash: string; role: Role }) {
  return prisma.user.create({ data });
}

export function update(id: string, data: { name?: string; role?: Role; isActive?: boolean }) {
  return prisma.user.update({ where: { id }, data });
}

/**
 * Grava o novo hash só se o atual ainda for "currentHash", numa única operação.
 * Se a senha foi trocada no meio do caminho, nada é gravado (count 0).
 */
export function updatePasswordHashIfUnchanged(id: string, currentHash: string, passwordHash: string) {
  return prisma.user.updateMany({
    where: { id, passwordHash: currentHash },
    data: { passwordHash },
  });
}
