import { prisma } from '../../src/database/prisma.js';
import type { Role } from '../../src/generated/prisma/enums.js';
import { hashPassword } from '../../src/modules/auth/password.js';

export const TEST_PASSWORD = 'senha-dos-testes-123';

/** Apaga todos os dados e reinicia a numeração dos chamados. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE ticket_events, ticket_comments, tickets, refresh_tokens, categories, users RESTART IDENTITY CASCADE`;
}

/** Um cenário pequeno e conhecido: um admin, um técnico, dois solicitantes e uma categoria. */
export async function seedTestData() {
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const createUser = (name: string, email: string, role: Role) =>
    prisma.user.create({ data: { name, email, role, passwordHash } });

  const admin = await createUser('Admin Teste', 'admin@test.example', 'ADMIN');
  const agent = await createUser('Técnico Teste', 'agent@test.example', 'AGENT');
  const ana = await createUser('Ana Teste', 'ana@test.example', 'REQUESTER');
  const bruno = await createUser('Bruno Teste', 'bruno@test.example', 'REQUESTER');
  const category = await prisma.category.create({ data: { name: 'Hardware' } });

  return { admin, agent, ana, bruno, category };
}

export type TestData = Awaited<ReturnType<typeof seedTestData>>;

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
