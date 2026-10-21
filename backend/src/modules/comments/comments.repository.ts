import { prisma } from '../../database/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { NewTicketEvent } from '../ticket-events/ticket-events.repository.js';
import type { TicketChanges } from '../tickets/tickets.repository.js';

const commentInclude = {
  author: { select: { id: true, name: true, role: true } },
} satisfies Prisma.TicketCommentInclude;

export type CommentWithAuthor = Prisma.TicketCommentGetPayload<{ include: typeof commentInclude }>;

export function listByTicket(ticketId: string, options: { includeInternal: boolean }) {
  return prisma.ticketComment.findMany({
    where: { ticketId, ...(options.includeInternal ? {} : { isInternal: false }) },
    orderBy: { createdAt: 'asc' },
    include: commentInclude,
  });
}

/**
 * Cria o comentário e, se pedido, altera o chamado (status, relógio do SLA e histórico) na MESMA
 * transação: ou tudo acontece, ou nada. O chamado só é alterado se ainda estiver como foi lido
 * (o mesmo updatedAt); se outra pessoa o alterou nesse meio-tempo, nada é gravado e a função devolve null.
 */
export function create(
  data: { ticketId: string; authorId: string; body: string; isInternal: boolean },
  ticketUpdate?: { changes: TicketChanges; expectedUpdatedAt: Date; events: NewTicketEvent[] },
) {
  return prisma.$transaction(async (tx) => {
    if (ticketUpdate) {
      const { count } = await tx.ticket.updateMany({
        where: { id: data.ticketId, updatedAt: ticketUpdate.expectedUpdatedAt },
        data: ticketUpdate.changes,
      });
      if (count === 0) return null;

      if (ticketUpdate.events.length > 0) await tx.ticketEvent.createMany({ data: ticketUpdate.events });
    }

    return tx.ticketComment.create({ data, include: commentInclude });
  });
}
