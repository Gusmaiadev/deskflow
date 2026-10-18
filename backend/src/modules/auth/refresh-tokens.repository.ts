import { prisma } from '../../database/prisma.js';

type NewRefreshToken = {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
};

export function create(data: NewRefreshToken) {
  return prisma.refreshToken.create({ data });
}

export function findByHash(tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

/**
 * Troca o token atual por um novo, de forma atômica.
 * Devolve false se o token atual já tinha sido usado (por exemplo, por outra
 * requisição no mesmo instante): nesse caso nada é criado.
 */
export function rotate(currentId: string, next: NewRefreshToken): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.refreshToken.updateMany({
      where: { id: currentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (count === 0) return false;

    await tx.refreshToken.create({ data: next });
    return true;
  });
}

/** Encerra uma sessão inteira: todos os tokens que nasceram do mesmo login. */
export function revokeFamily(familyId: string) {
  return prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Encerra todas as sessões de um usuário, em todos os dispositivos. */
export function revokeAllForUser(userId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Encerra as sessões do usuário nos outros dispositivos, mantendo a indicada (a atual). */
export function revokeOtherFamiliesForUser(userId: string, keepFamilyId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, familyId: { not: keepFamilyId } },
    data: { revokedAt: new Date() },
  });
}

/** Limpeza: tokens vencidos não servem nem para detectar reuso. */
export function deleteExpiredForUser(userId: string) {
  return prisma.refreshToken.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  });
}
