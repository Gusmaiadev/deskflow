import { TicketPriority, TicketStatus } from '../../generated/prisma/enums.js';
import { OPEN_STATUSES } from '../tickets/ticket-rules.js';
import * as dashboardRepository from './dashboard.repository.js';

const SLA_PERIOD_DAYS = 30;
const CHART_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Transforma o resultado de um groupBy num objeto com TODAS as chaves, inclusive as que ficaram com zero. */
function countsFor<K extends string>(keys: readonly K[], rows: { key: K; total: number }[]): Record<K, number> {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const row of rows) result[row.key] = row.total;
  return result;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function getDashboard() {
  const now = new Date();
  const slaSince = new Date(now.getTime() - SLA_PERIOD_DAYS * DAY_IN_MS);

  // As consultas são independentes: rodam em paralelo, cada uma numa conexão do pool.
  const [byStatusRows, byPriorityRows, overdue, unassigned, byCategory, sla, createdPerDay] = await Promise.all([
    dashboardRepository.countByStatus(),
    dashboardRepository.countOpenByPriority(),
    dashboardRepository.countOverdue(now),
    dashboardRepository.countUnassigned(),
    dashboardRepository.countOpenByCategory(),
    dashboardRepository.slaStats(slaSince),
    dashboardRepository.createdPerDay(CHART_DAYS),
  ]);

  const byStatus = countsFor(
    Object.values(TicketStatus),
    byStatusRows.map((row) => ({ key: row.status, total: row._count._all })),
  );

  const byPriority = countsFor(
    Object.values(TicketPriority),
    byPriorityRows.map((row) => ({ key: row.priority, total: row._count._all })),
  );

  return {
    generatedAt: now,
    summary: {
      open: OPEN_STATUSES.reduce((total, status) => total + byStatus[status], 0),
      overdue,
      unassigned,
      resolvedLast30Days: sla.resolved,
    },
    sla: {
      periodDays: SLA_PERIOD_DAYS,
      resolved: sla.resolved,
      withinSla: sla.withinSla,
      compliancePercent: sla.resolved > 0 ? roundTo((sla.withinSla / sla.resolved) * 100, 1) : null,
      averageResolutionHours:
        sla.averageResolutionHours === null ? null : roundTo(sla.averageResolutionHours, 1),
    },
    byStatus,
    openByPriority: byPriority,
    openByCategory: byCategory,
    createdPerDay,
  };
}
