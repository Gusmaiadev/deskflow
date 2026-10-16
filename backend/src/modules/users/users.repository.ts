import { prisma } from '../../database/prisma.js';
import type { Role } from '../../generated/prisma/client.js';

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
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

export function updatePasswordHash(id: string, passwordHash: string) {
  return prisma.user.update({ where: { id }, data: { passwordHash } });
}
