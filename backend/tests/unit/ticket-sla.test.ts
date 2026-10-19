import { describe, expect, it } from 'vitest';
import { calculateDueAt, SLA_HOURS } from '../../src/modules/tickets/ticket-sla.js';

describe('calculateDueAt', () => {
  const openedAt = new Date('2026-10-14T09:00:00.000Z');

  it.each([
    ['URGENT', '2026-10-14T13:00:00.000Z'],
    ['HIGH', '2026-10-14T17:00:00.000Z'],
    ['MEDIUM', '2026-10-15T09:00:00.000Z'],
    ['LOW', '2026-10-17T09:00:00.000Z'],
  ] as const)('prioridade %s vence em %s', (priority, expected) => {
    expect(calculateDueAt(priority, openedAt).toISOString()).toBe(expected);
  });

  it('não altera a data de abertura recebida', () => {
    const before = openedAt.getTime();

    calculateDueAt('URGENT', openedAt);

    expect(openedAt.getTime()).toBe(before);
  });

  it('quanto maior a prioridade, menor o prazo', () => {
    expect(SLA_HOURS.URGENT).toBeLessThan(SLA_HOURS.HIGH);
    expect(SLA_HOURS.HIGH).toBeLessThan(SLA_HOURS.MEDIUM);
    expect(SLA_HOURS.MEDIUM).toBeLessThan(SLA_HOURS.LOW);
  });
});
