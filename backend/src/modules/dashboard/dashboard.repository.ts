import { prisma } from '../../database/prisma.js';
import { OPEN_STATUSES } from '../tickets/ticket-rules.js';
import { overdueWhere } from '../tickets/tickets.repository.js';

/** Fuso usado para agrupar os chamados por dia no gráfico. */
const TIME_ZONE = 'America/Sao_Paulo';

export function countByStatus() {
  return prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } });
}

export function countOpenByPriority() {
  return prisma.ticket.groupBy({
    by: ['priority'],
    where: { status: { in: [...OPEN_STATUSES] } },
    _count: { _all: true },
  });
}

export function countOverdue(now: Date) {
  return prisma.ticket.count({ where: overdueWhere(now) }); // a mesma regra do filtro "atrasados"
}

export function countUnassigned() {
  return prisma.ticket.count({ where: { status: { in: [...OPEN_STATUSES] }, assigneeId: null } });
}

/** Chamados em andamento por categoria. Consulta em SQL para fazer o JOIN e a ordenação no banco. */
export function countOpenByCategory() {
  return prisma.$queryRaw<{ category: string; total: number }[]>`
    SELECT c.name AS category, count(*)::int AS total
    FROM tickets t
    JOIN categories c ON c.id = t.category_id
    WHERE t.status IN ('OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER')
    GROUP BY c.name
    ORDER BY total DESC, c.name
  `;
}

/** Desempenho do SLA entre os chamados resolvidos desde uma data. */
export async function slaStats(since: Date) {
  const [row] = await prisma.$queryRaw<
    { resolved: number; withinSla: number; averageResolutionHours: number | null }[]
  >`
    SELECT
      count(*)::int AS "resolved",
      (count(*) FILTER (WHERE resolved_at <= due_at))::int AS "withinSla",
      (avg(extract(epoch FROM resolved_at - created_at)) / 3600)::float8 AS "averageResolutionHours"
    FROM tickets
    WHERE resolved_at IS NOT NULL AND resolved_at >= ${since}
  `;

  return row ?? { resolved: 0, withinSla: 0, averageResolutionHours: null };
}

/** Quantidade de chamados abertos em cada um dos últimos dias, incluindo os dias sem nenhum. */
export function createdPerDay(days: number) {
  return prisma.$queryRaw<{ date: string; total: number }[]>`
    WITH period AS (
      SELECT generate_series(
        (now() AT TIME ZONE ${TIME_ZONE})::date - ${days - 1}::int,
        (now() AT TIME ZONE ${TIME_ZONE})::date,
        interval '1 day'
      )::date AS day
    )
    SELECT to_char(p.day, 'YYYY-MM-DD') AS date, count(t.id)::int AS total
    FROM period p
    LEFT JOIN tickets t ON (t.created_at AT TIME ZONE ${TIME_ZONE})::date = p.day
    GROUP BY p.day
    ORDER BY p.day
  `;
}
