import type { Response } from 'supertest';
import { prisma } from '../../src/database/prisma.js';
import type { Prisma } from '../../src/generated/prisma/client.js';

/**
 * Espera até a requisição estar parada, aguardando o bloqueio que esta transação segura. Lê pg_locks
 * (o PostgreSQL inteiro, com os outros bancos: pg_blocking_pids filtra quem espera por esta transação),
 * e não pg_stat_activity, que o PostgreSQL congela na 1ª leitura dentro de uma transação.
 */
async function untilSomeoneWaitsForUs(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const [row] = await tx.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_locks
      WHERE NOT granted AND pg_backend_pid() = ANY (pg_blocking_pids(pid))
    `;
    if (row && row.waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('A requisição não chegou a esperar pelo bloqueio da linha.');
}

/**
 * Simula outra requisição gravando a mesma linha no mesmo instante: `change` grava (e bloqueia) a linha
 * numa transação, que só confirma depois que a requisição de `send` já leu a versão antiga e ficou
 * esperando para gravar. Devolve a resposta dessa requisição.
 */
export async function whileAnotherRequestWrites(
  change: (tx: Prisma.TransactionClient) => Promise<unknown>,
  send: () => PromiseLike<Response>,
): Promise<Response> {
  let pending: Promise<Response> | undefined;

  await prisma.$transaction(async (tx) => {
    await change(tx);
    pending = Promise.resolve(send());
    await untilSomeoneWaitsForUs(tx);
  });

  if (!pending) throw new Error('A requisição não foi enviada.');
  return pending;
}
