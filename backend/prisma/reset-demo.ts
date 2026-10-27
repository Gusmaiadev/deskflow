import { createInterface } from 'node:readline/promises';
import { env } from '../src/config/env.js';
import { prisma } from '../src/database/prisma.js';
import { categories, users } from './seed-data.js';

// Reinicia os dados da demonstração: apaga TODOS os chamados (os comentários e o
// histórico vão junto, pelo onDelete: Cascade), as contas e as categorias criadas
// por visitantes e todas as sessões. Em seguida, o "prisma db seed" restaura os
// usuários e as categorias de exemplo e recria os 8 chamados, porque a tabela ficou vazia.
//
// Com --yes, roda sem perguntar: é assim que o agendamento da meia-noite chama.

const host = new URL(env.DATABASE_URL).hostname;
const total = await prisma.ticket.count();
const seedEmails = users.map((user) => user.email);
const seedCategoryNames = categories.map((category) => category.name);

let confirmed = process.argv.includes('--yes');

if (!confirmed) {
  // Confirmação digitada: um comando que apaga dados não pode rodar por engano.
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await terminal.question(
    `Apagar os ${total} chamados, as contas e categorias novas e as sessões do banco em ${host}? Digite "apagar" para confirmar: `,
  );
  terminal.close();
  confirmed = answer.trim() === 'apagar';
}

if (confirmed) {
  // Nesta ordem: chamados e comentários apontam para usuários e categorias (onDelete: Restrict).
  const [tickets, sessions, newUsers, newCategories] = await prisma.$transaction([
    prisma.ticket.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany({ where: { email: { notIn: seedEmails } } }),
    prisma.category.deleteMany({ where: { name: { notIn: seedCategoryNames } } }),
  ]);
  console.log(
    `🧹 ${new Date().toISOString()} em ${host}: ${tickets.count} chamados, ${newUsers.count} contas novas, ` +
      `${newCategories.count} categorias novas e ${sessions.count} sessões apagados.`,
  );
} else {
  console.log('Nada foi apagado.');
  // Código de saída diferente de zero: o "&&" do script do npm não roda o seed.
  process.exitCode = 1;
}

await prisma.$disconnect();
