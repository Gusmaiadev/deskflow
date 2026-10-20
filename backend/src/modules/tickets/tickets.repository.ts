import { escapeLikePattern } from '../../database/like.js';
import { prisma } from '../../database/prisma.js';
import type { Prisma, TicketPriority, TicketStatus } from '../../generated/prisma/client.js';
import { OPEN_STATUSES } from './ticket-rules.js';
import type { TicketSort } from './tickets.schemas.js';

const userSummary = { select: { id: true, name: true } } as const;

/** Relações que acompanham todo chamado devolvido pela API, só com os campos necessários. */
const ticketInclude = {
  category: { select: { id: true, name: true } },
  requester: userSummary,
  assignee: userSummary,
} satisfies Prisma.TicketInclude;

export type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

export type TicketFilters = {
  requesterId?: string;
  assigneeId?: string | null; // null = sem responsável
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: string;
  overdue?: boolean;
  search?: string;
};

export type NewTicket = {
  title: string;
  description: string;
  priority: TicketPriority;
  categoryId: string;
  requesterId: string;
  createdAt: Date;
  dueAt: Date;
};

export type TicketChanges = {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: string;
  assigneeId?: string | null;
  dueAt?: Date;
  waitingSince?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
};

/** Toda ordenação termina pelo número do chamado: sem empate, a paginação fica estável. */
const ORDER_BY: Record<TicketSort, Prisma.TicketOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { number: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { number: 'asc' }],
  due: [{ dueAt: 'asc' }, { number: 'asc' }],
  priority: [{ priority: 'desc' }, { dueAt: 'asc' }, { number: 'asc' }],
};

const MAX_INTEGER = 2_147_483_647; // maior valor de uma coluna INTEGER no PostgreSQL

/**
 * Atrasados: em andamento e com o prazo vencido. Enquanto o chamado aguarda o solicitante, o relógio
 * está parado em waitingSince (a mesma regra de isOverdue), então o prazo é comparado com essa coluna.
 */
export function overdueWhere(now: Date): Prisma.TicketWhereInput {
  return {
    status: { in: [...OPEN_STATUSES] },
    OR: [{ waitingSince: null, dueAt: { lt: now } }, { dueAt: { lt: prisma.ticket.fields.waitingSince } }],
  };
}

/** Traduz os filtros da aplicação para a linguagem de consulta do Prisma. */
function buildWhere(filters: TicketFilters, now: Date): Prisma.TicketWhereInput {
  const conditions: Prisma.TicketWhereInput[] = [];

  if (filters.requesterId) conditions.push({ requesterId: filters.requesterId });
  if (filters.assigneeId !== undefined) conditions.push({ assigneeId: filters.assigneeId });
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.priority) conditions.push({ priority: filters.priority });
  if (filters.categoryId) conditions.push({ categoryId: filters.categoryId });

  if (filters.overdue === true) {
    conditions.push(overdueWhere(now));
  } else if (filters.overdue === false) {
    // O contrário de overdueWhere, por extenso: com NOT, a comparação com um waitingSince nulo
    // daria NULL no SQL e deixaria de fora os chamados no prazo.
    conditions.push({
      OR: [
        { status: { notIn: [...OPEN_STATUSES] } },
        { waitingSince: null, dueAt: { gte: now } },
        { dueAt: { gte: prisma.ticket.fields.waitingSince } },
      ],
    });
  }

  if (filters.search) {
    const digits = filters.search.replace(/^#/, '');
    const number = /^\d{1,10}$/.test(digits) ? Number(digits) : undefined;
    const searchByNumber = number !== undefined && number <= MAX_INTEGER ? [{ number }] : [];
    const text = escapeLikePattern(filters.search);

    conditions.push({
      OR: [
        { title: { contains: text, mode: 'insensitive' } },
        { description: { contains: text, mode: 'insensitive' } },
        ...searchByNumber,
      ],
    });
  }

  return { AND: conditions };
}

export async function list(filters: TicketFilters, sort: TicketSort, page: { skip: number; take: number }) {
  const where = buildWhere(filters, new Date());

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: page.skip,
      take: page.take,
      include: ticketInclude,
    }),
    prisma.ticket.count({ where }),
  ]);

  return { items, total };
}

export function findById(id: string) {
  return prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
}

export function create(data: NewTicket) {
  return prisma.ticket.create({ data, include: ticketInclude });
}

export function update(id: string, changes: TicketChanges) {
  return prisma.ticket.update({ where: { id }, data: changes, include: ticketInclude });
}
