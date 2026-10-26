import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error.js';
import type { AccessTokenUser } from '../auth/access-token.js';
import * as categoriesRepository from '../categories/categories.repository.js';
import { eventsFromChanges } from '../ticket-events/events-from-changes.js';
import * as usersRepository from '../users/users.repository.js';
import { allowedTransitions, canTransition, isStaff } from './ticket-rules.js';
import { calculateDueAt, recalculateDueAt, slaPauseChanges } from './ticket-sla.js';
import { toTicketResponse, type TicketDetailResponse, type TicketResponse } from './tickets.mapper.js';
import * as ticketsRepository from './tickets.repository.js';
import type { TicketChanges, TicketWithRelations } from './tickets.repository.js';
import type { CreateTicketInput, ListTicketsQuery, UpdateTicketInput } from './tickets.schemas.js';

type Actor = AccessTokenUser;

export type TicketPage = {
  data: TicketResponse[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

/** Campos que só técnicos e admins podem alterar. */
const STAFF_ONLY_FIELDS = ['priority', 'categoryId', 'assigneeId'] as const;

export async function listTickets(actor: Actor, query: ListTicketsQuery): Promise<TicketPage> {
  const assigneeId = query.assignee === 'me' ? actor.id : query.assignee === 'none' ? null : query.assignee;

  const { items, total } = await ticketsRepository.list(
    {
      // Escopo por perfil: o solicitante só enxerga os próprios chamados, quaisquer que sejam os filtros.
      requesterId: isStaff(actor.role) ? undefined : actor.id,
      assigneeId,
      status: query.status,
      priority: query.priority,
      categoryId: query.categoryId,
      overdue: query.overdue,
      search: query.q,
    },
    query.sort,
    { skip: (query.page - 1) * query.pageSize, take: query.pageSize },
  );

  const now = new Date();

  return {
    data: items.map((ticket) => toTicketResponse(ticket, now)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

/**
 * Busca um chamado que o usuário tem o direito de ver.
 * Para quem não tem esse direito, o chamado simplesmente "não existe" (404).
 */
export async function findAccessibleTicket(actor: Actor, ticketId: string): Promise<TicketWithRelations> {
  const ticket = await ticketsRepository.findById(ticketId);

  if (!ticket || (!isStaff(actor.role) && ticket.requesterId !== actor.id)) {
    throw new NotFoundError('Chamado não encontrado.', 'TICKET_NOT_FOUND');
  }

  return ticket;
}

/** O chamado com as transições de status que o usuário atual pode fazer. */
function toTicketDetail(actor: Actor, ticket: TicketWithRelations, now: Date = new Date()): TicketDetailResponse {
  return {
    ...toTicketResponse(ticket, now),
    allowedStatuses: [...allowedTransitions(actor.role, ticket.status)],
  };
}

export async function getTicket(actor: Actor, ticketId: string): Promise<TicketDetailResponse> {
  return toTicketDetail(actor, await findAccessibleTicket(actor, ticketId));
}

async function ensureActiveCategory(categoryId: string): Promise<void> {
  const category = await categoriesRepository.findById(categoryId);

  if (!category || !category.isActive) {
    throw new BadRequestError('A categoria não existe ou está desativada.', 'INVALID_CATEGORY');
  }
}

async function ensureValidAssignee(userId: string): Promise<void> {
  const user = await usersRepository.findById(userId);

  if (!user || !user.isActive || !isStaff(user.role)) {
    throw new BadRequestError('O responsável precisa ser um técnico ou admin ativo.', 'INVALID_ASSIGNEE');
  }
}

export async function createTicket(actor: Actor, input: CreateTicketInput): Promise<TicketResponse> {
  await ensureActiveCategory(input.categoryId);

  const openedAt = new Date();

  const ticket = await ticketsRepository.create({
    title: input.title,
    description: input.description,
    priority: input.priority,
    categoryId: input.categoryId,
    requesterId: actor.id,
    createdAt: openedAt,
    dueAt: calculateDueAt(input.priority, openedAt),
  });

  return toTicketResponse(ticket);
}

export async function updateTicket(
  actor: Actor,
  ticketId: string,
  input: UpdateTicketInput,
): Promise<TicketDetailResponse> {
  const ticket = await findAccessibleTicket(actor, ticketId);
  const staff = isStaff(actor.role);

  if (ticket.status === 'CLOSED') {
    throw new ConflictError('Chamados fechados não podem ser alterados.', 'TICKET_CLOSED');
  }

  if (!staff) {
    const forbiddenFields = STAFF_ONLY_FIELDS.filter((field) => input[field] !== undefined);

    if (forbiddenFields.length > 0) {
      throw new ForbiddenError(
        `Somente a equipe de suporte pode alterar: ${forbiddenFields.join(', ')}.`,
        'STAFF_ONLY_FIELDS',
      );
    }

    const editsText = input.title !== undefined || input.description !== undefined;

    if (editsText && ticket.status !== 'OPEN') {
      throw new ConflictError(
        'Título e descrição só podem ser editados enquanto o chamado está aberto.',
        'TICKET_NOT_EDITABLE',
      );
    }
  }

  const now = new Date();
  const changes: TicketChanges = {};

  if (input.title !== undefined && input.title !== ticket.title) changes.title = input.title;
  if (input.description !== undefined && input.description !== ticket.description) changes.description = input.description;

  if (input.categoryId !== undefined && input.categoryId !== ticket.categoryId) {
    await ensureActiveCategory(input.categoryId);
    changes.categoryId = input.categoryId;
  }

  if (input.priority !== undefined && input.priority !== ticket.priority) {
    changes.priority = input.priority;
    // O prazo é recalculado a partir da abertura, com o SLA da nova prioridade (sem perder as pausas).
    changes.dueAt = recalculateDueAt(ticket, input.priority);
  }

  if (input.assigneeId !== undefined && input.assigneeId !== ticket.assigneeId) {
    if (input.assigneeId !== null) await ensureValidAssignee(input.assigneeId);
    changes.assigneeId = input.assigneeId;
  }

  if (input.status !== undefined && input.status !== ticket.status) {
    if (!canTransition(actor.role, ticket.status, input.status)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Não é possível mudar o status de ${ticket.status} para ${input.status}.`,
        { allowed: allowedTransitions(actor.role, ticket.status) },
      );
    }

    changes.status = input.status;
    // Aguardando o solicitante, o relógio do SLA para; na saída, o prazo anda o tempo parado.
    const pause = slaPauseChanges(ticket, input.status, changes.dueAt ?? ticket.dueAt, now);
    changes.waitingSince = pause.waitingSince;
    if (pause.dueAt) changes.dueAt = pause.dueAt;

    if (input.status === 'RESOLVED') changes.resolvedAt = now;
    if (input.status === 'CLOSED') changes.closedAt = now;
    if (ticket.status === 'RESOLVED' && input.status === 'IN_PROGRESS') changes.resolvedAt = null; // reaberto

    // Quem começa a atender um chamado sem responsável assume o chamado.
    if (input.status === 'IN_PROGRESS' && staff && !ticket.assigneeId && input.assigneeId === undefined) {
      changes.assigneeId = actor.id;
    }
  }

  if (Object.keys(changes).length === 0) {
    return toTicketDetail(actor, ticket, now);
  }

  // Só grava se ninguém alterou o chamado desde a leitura: em duas alterações simultâneas, vale a primeira.
  // Status, prioridade e responsável que mudaram entram no histórico, na mesma transação.
  const events = eventsFromChanges(ticket, changes, actor.id);
  const updated = await ticketsRepository.update(ticketId, changes, ticket.updatedAt, events);

  if (!updated) {
    throw new ConflictError('O chamado foi alterado por outra pessoa. Recarregue e tente de novo.', 'TICKET_CHANGED');
  }

  return toTicketDetail(actor, updated, now);
}
