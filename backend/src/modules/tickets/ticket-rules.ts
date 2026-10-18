import type { Role, TicketStatus } from '../../generated/prisma/enums.js';

/** Status em que o chamado ainda corre contra o prazo do SLA. */
export const OPEN_STATUSES: readonly TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER'];

/** Para onde a equipe de suporte (técnicos e admins) pode levar um chamado. */
const STAFF_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'WAITING_REQUESTER', 'RESOLVED'],
  WAITING_REQUESTER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

/** O solicitante só cancela um chamado ainda não atendido, ou responde à solução. */
const REQUESTER_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['CLOSED'],
  IN_PROGRESS: [],
  WAITING_REQUESTER: [],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

/** Técnicos e admins formam a "equipe de suporte". */
export function isStaff(role: Role): boolean {
  return role === 'AGENT' || role === 'ADMIN';
}

export function allowedTransitions(role: Role, from: TicketStatus): readonly TicketStatus[] {
  return isStaff(role) ? STAFF_TRANSITIONS[from] : REQUESTER_TRANSITIONS[from];
}

export function canTransition(role: Role, from: TicketStatus, to: TicketStatus): boolean {
  return allowedTransitions(role, from).includes(to);
}

/** Atrasado: ainda em andamento e com o prazo vencido. */
export function isOverdue(ticket: { status: TicketStatus; dueAt: Date }, now: Date = new Date()): boolean {
  return OPEN_STATUSES.includes(ticket.status) && ticket.dueAt < now;
}
