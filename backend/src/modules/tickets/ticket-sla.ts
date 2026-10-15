import type { TicketPriority } from '../../generated/prisma/client.js';

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
