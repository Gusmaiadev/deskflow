import type { TicketPriority, TicketStatus } from '../../generated/prisma/client.js';

/**
 * Prazo máximo de atendimento (em horas) para cada prioridade.
 * Fonte única da regra de SLA: o seed usa hoje, e o service de chamados usará no Dia 4.
 */
export const SLA_HOURS: Record<TicketPriority, number> = {
  URGENT: 4,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 72,
};

const HOUR_IN_MS = 60 * 60 * 1000;

/** Calcula o prazo do chamado a partir do momento em que ele foi aberto. */
export function calculateDueAt(priority: TicketPriority, openedAt: Date = new Date()): Date {
  return new Date(openedAt.getTime() + SLA_HOURS[priority] * HOUR_IN_MS);
}

/**
 * Prazo depois de uma troca de prioridade: o SLA da nova prioridade, contado da abertura, mais o tempo
 * em que o chamado já ficou pausado (o quanto o prazo atual passa do prazo original).
 */
export function recalculateDueAt(
  ticket: { priority: TicketPriority; createdAt: Date; dueAt: Date },
  priority: TicketPriority,
): Date {
  const pausedMs = Math.max(0, ticket.dueAt.getTime() - calculateDueAt(ticket.priority, ticket.createdAt).getTime());
  return new Date(calculateDueAt(priority, ticket.createdAt).getTime() + pausedMs);
}

/**
 * O que muda no relógio do SLA quando o status muda. Aguardando o solicitante, o relógio para;
 * na saída, o prazo anda para a frente exatamente o tempo parado. Toda mudança de status grava o
 * waitingSince correspondente, para o par status/pausa nunca ficar inconsistente.
 *
 * Limite conhecido: as contas usam o chamado lido no início da requisição. Se alguém tira o chamado
 * da espera no mesmo instante em que outra pessoa troca a prioridade, vale a gravação que chegar por
 * último, e a conta da outra se perde. Fechar isso exige controle de concorrência na gravação.
 */
export function slaPauseChanges(
  ticket: { waitingSince: Date | null },
  status: TicketStatus,
  dueAt: Date,
  now: Date = new Date(),
): { waitingSince: Date | null; dueAt?: Date } {
  if (status === 'WAITING_REQUESTER') return { waitingSince: now };
  if (!ticket.waitingSince) return { waitingSince: null };

  // Um relógio que voltou no tempo não pode encurtar o prazo.
  const pausedMs = Math.max(0, now.getTime() - ticket.waitingSince.getTime());
  return { waitingSince: null, dueAt: new Date(dueAt.getTime() + pausedMs) };
}
