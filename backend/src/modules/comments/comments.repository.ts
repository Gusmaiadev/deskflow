import { prisma } from '../../database/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
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
 * Cria o comentário e, se pedido, altera o chamado (status e relógio do SLA) na MESMA transação:
 * ou as duas coisas acontecem, ou nenhuma.
 */
export function create(
  data: { ticketId: string; authorId: string; body: string; isInternal: boolean },
  ticketChanges?: TicketChanges,
) {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.ticketComment.create({ data, include: commentInclude });

    if (ticketChanges) {
      await tx.ticket.update({ where: { id: data.ticketId }, data: ticketChanges });
    }

    return comment;
  });
}
