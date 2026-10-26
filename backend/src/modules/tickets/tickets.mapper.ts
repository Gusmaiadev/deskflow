import type { TicketPriority, TicketStatus } from '../../generated/prisma/enums.js';
import { isOverdue } from './ticket-rules.js';
import type { TicketWithRelations } from './tickets.repository.js';

type PersonSummary = { id: string; name: string };

/** DTO de saída de um chamado. */
export type TicketResponse = {
  id: string;
  number: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  isOverdue: boolean;
  dueAt: Date;
  waitingSince: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string };
  requester: PersonSummary;
  assignee: PersonSummary | null;
};

/** O detalhe do chamado leva também o que quem está vendo pode fazer com ele. */
export type TicketDetailResponse = TicketResponse & {
  /** Para quais status o usuário atual pode levar o chamado. A tela mostra só estas opções. */
  allowedStatuses: TicketStatus[];
};

export function toTicketResponse(ticket: TicketWithRelations, now: Date = new Date()): TicketResponse {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    isOverdue: isOverdue(ticket, now),
    dueAt: ticket.dueAt,
    waitingSince: ticket.waitingSince,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    category: ticket.category,
    requester: ticket.requester,
    assignee: ticket.assignee,
  };
}
