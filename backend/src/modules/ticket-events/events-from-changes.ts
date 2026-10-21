import type { TicketPriority, TicketStatus } from '../../generated/prisma/enums.js';
import type { NewTicketEvent } from './ticket-events.repository.js';

/** Os campos do chamado que entram no histórico. */
type TrackedFields = { status: TicketStatus; priority: TicketPriority; assigneeId: string | null };

/**
 * Os eventos do histórico para uma alteração: um por campo acompanhado que mudou de verdade,
 * com o valor anterior e o novo. Título, descrição, categoria, prazo e as datas não entram.
 */
export function eventsFromChanges(
  ticket: { id: string } & TrackedFields,
  changes: Partial<TrackedFields>,
  actorId: string,
): NewTicketEvent[] {
  const events: NewTicketEvent[] = [];
  const event = (field: NewTicketEvent['field'], fromValue: string | null, toValue: string | null) =>
    events.push({ ticketId: ticket.id, actorId, field, fromValue, toValue });

  if (changes.status !== undefined && changes.status !== ticket.status) {
    event('STATUS', ticket.status, changes.status);
  }
  if (changes.priority !== undefined && changes.priority !== ticket.priority) {
    event('PRIORITY', ticket.priority, changes.priority);
  }
  if (changes.assigneeId !== undefined && changes.assigneeId !== ticket.assigneeId) {
    event('ASSIGNEE', ticket.assigneeId, changes.assigneeId);
  }

  return events;
}
