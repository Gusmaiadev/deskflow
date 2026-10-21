import { describe, expect, it } from 'vitest';
import { calculateDueAt, recalculateDueAt, SLA_HOURS, slaPauseChanges } from '../../src/modules/tickets/ticket-sla.js';

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

describe('recalculateDueAt', () => {
  const createdAt = new Date('2026-10-14T09:00:00.000Z');

  it('sem pausas, usa o SLA da nova prioridade a partir da abertura', () => {
    const ticket = { priority: 'MEDIUM' as const, createdAt, dueAt: calculateDueAt('MEDIUM', createdAt) };

    expect(recalculateDueAt(ticket, 'HIGH').toISOString()).toBe('2026-10-14T17:00:00.000Z');
  });

  it('mantém o tempo em que o chamado já ficou pausado', () => {
    // Média: venceria às 09:00 do dia 15; 3 h de pausa levaram o prazo para as 12:00.
    const ticket = { priority: 'MEDIUM' as const, createdAt, dueAt: new Date('2026-10-15T12:00:00.000Z') };

    expect(recalculateDueAt(ticket, 'HIGH').toISOString()).toBe('2026-10-14T20:00:00.000Z');
  });

  it('um prazo menor que o SLA original não vira pausa negativa', () => {
    // Ex.: prazo gravado antes de o SLA da prioridade aumentar. Não há pausa a manter.
    const ticket = { priority: 'MEDIUM' as const, createdAt, dueAt: new Date('2026-10-14T21:00:00.000Z') };

    expect(recalculateDueAt(ticket, 'HIGH').toISOString()).toBe('2026-10-14T17:00:00.000Z');
  });
});

describe('slaPauseChanges', () => {
  const now = new Date('2026-10-14T12:00:00.000Z');
  const dueAt = new Date('2026-10-14T17:00:00.000Z');

  it('ao aguardar o solicitante, guarda o início da pausa', () => {
    expect(slaPauseChanges({ waitingSince: null }, 'WAITING_REQUESTER', dueAt, now)).toEqual({ waitingSince: now });
  });

  it('ao sair da espera, empurra o prazo pelo tempo parado', () => {
    const waitingSince = new Date('2026-10-14T09:30:00.000Z'); // 2 h 30 min parado

    expect(slaPauseChanges({ waitingSince }, 'IN_PROGRESS', dueAt, now)).toEqual({
      waitingSince: null,
      dueAt: new Date('2026-10-14T19:30:00.000Z'),
    });
  });

  it('um início de pausa no futuro (relógio que voltou) não encurta o prazo', () => {
    const waitingSince = new Date('2026-10-14T12:05:00.000Z');

    expect(slaPauseChanges({ waitingSince }, 'IN_PROGRESS', dueAt, now)).toEqual({ waitingSince: null, dueAt });
  });

  it('nas outras mudanças de status, o relógio continua como estava', () => {
    expect(slaPauseChanges({ waitingSince: null }, 'RESOLVED', dueAt, now)).toEqual({ waitingSince: null });
  });
});
