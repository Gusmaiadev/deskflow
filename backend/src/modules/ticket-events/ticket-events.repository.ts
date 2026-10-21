import { prisma } from '../../database/prisma.js';
import type { Prisma, TicketEventField } from '../../generated/prisma/client.js';

/**
 * Um evento a gravar. Status e prioridade guardam o nome do valor; o responsável guarda o id do
 * usuário (ou null, sem responsável). Os eventos são gravados na mesma transação da alteração do
 * chamado (tickets.repository.update e comments.repository.create), e só se ela valer.
 */
export type NewTicketEvent = {
  ticketId: string;
  actorId: string;
  field: TicketEventField;
  fromValue: string | null;
  toValue: string | null;
};

const eventInclude = {
  actor: { select: { id: true, name: true } },
} satisfies Prisma.TicketEventInclude;

export type TicketEventWithActor = Prisma.TicketEventGetPayload<{ include: typeof eventInclude }>;

/** A linha do tempo do chamado, do mais antigo para o mais novo. */
export function listByTicket(ticketId: string) {
  return prisma.ticketEvent.findMany({
    where: { ticketId },
    // Eventos da mesma alteração têm a mesma data: a ordem do enum (status, prioridade, responsável) desempata.
    orderBy: [{ createdAt: 'asc' }, { field: 'asc' }],
    include: eventInclude,
  });
}
