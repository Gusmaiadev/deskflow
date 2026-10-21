import { ConflictError, ForbiddenError } from '../../shared/errors/app-error.js';
import type { AccessTokenUser } from '../auth/access-token.js';
import { eventsFromChanges } from '../ticket-events/events-from-changes.js';
import { isStaff } from '../tickets/ticket-rules.js';
import { slaPauseChanges } from '../tickets/ticket-sla.js';
import { findAccessibleTicket } from '../tickets/tickets.service.js';
import { toCommentResponse, type CommentResponse } from './comments.mapper.js';
import * as commentsRepository from './comments.repository.js';
import type { CreateCommentInput } from './comments.schemas.js';

type Actor = AccessTokenUser;

export async function listComments(actor: Actor, ticketId: string): Promise<CommentResponse[]> {
  // Reaproveita a regra de acesso dos chamados: quem não vê o chamado, não vê os comentários.
  await findAccessibleTicket(actor, ticketId);

  const comments = await commentsRepository.listByTicket(ticketId, {
    includeInternal: isStaff(actor.role), // notas internas: só para a equipe
  });

  return comments.map(toCommentResponse);
}

export async function addComment(actor: Actor, ticketId: string, input: CreateCommentInput): Promise<CommentResponse> {
  const ticket = await findAccessibleTicket(actor, ticketId);

  // Limite conhecido: um comentário comum que chega no mesmo instante do fechamento ainda é gravado.
  if (ticket.status === 'CLOSED') {
    throw new ConflictError('Não é possível comentar em um chamado fechado.', 'TICKET_CLOSED');
  }

  if (input.isInternal && !isStaff(actor.role)) {
    throw new ForbiddenError('Somente a equipe de suporte pode criar notas internas.', 'INTERNAL_NOTE_FORBIDDEN');
  }

  // O solicitante respondeu o que a equipe perguntou: o chamado volta para atendimento,
  // e o relógio do SLA volta a correr.
  const requesterReplied = !isStaff(actor.role) && ticket.status === 'WAITING_REQUESTER';
  const resume = requesterReplied
    ? { status: 'IN_PROGRESS' as const, ...slaPauseChanges(ticket, 'IN_PROGRESS', ticket.dueAt) }
    : undefined;

  // A volta para atendimento (e o evento no histórico) só vale se ninguém alterou o chamado desde a leitura.
  const comment = await commentsRepository.create(
    { ticketId, authorId: actor.id, body: input.body, isInternal: input.isInternal },
    resume && { changes: resume, expectedUpdatedAt: ticket.updatedAt, events: eventsFromChanges(ticket, resume, actor.id) },
  );

  if (!comment) {
    // O texto continua no formulário: basta enviar de novo, sem recarregar a página.
    throw new ConflictError(
      'O chamado foi alterado por outra pessoa enquanto você respondia. Envie a resposta de novo.',
      'TICKET_CHANGED',
    );
  }

  return toCommentResponse(comment);
}
