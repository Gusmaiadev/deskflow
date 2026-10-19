import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, isOverdue } from '../../src/modules/tickets/ticket-rules.js';

describe('canTransition', () => {
  it('a equipe pode iniciar o atendimento de um chamado aberto', () => {
    expect(canTransition('AGENT', 'OPEN', 'IN_PROGRESS')).toBe(true);
  });

  it('o solicitante não pode iniciar o atendimento', () => {
    expect(canTransition('REQUESTER', 'OPEN', 'IN_PROGRESS')).toBe(false);
  });

  it('o solicitante pode confirmar ou reabrir um chamado resolvido', () => {
    expect(allowedTransitions('REQUESTER', 'RESOLVED')).toEqual(['IN_PROGRESS', 'CLOSED']);
  });

  it('um chamado em atendimento não pode ser fechado sem antes ser resolvido', () => {
    expect(canTransition('ADMIN', 'IN_PROGRESS', 'CLOSED')).toBe(false);
  });

  it('nenhum perfil mexe num chamado fechado', () => {
    for (const role of ['REQUESTER', 'AGENT', 'ADMIN'] as const) {
      expect(allowedTransitions(role, 'CLOSED')).toEqual([]);
    }
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-10-14T12:00:00.000Z');
  const oneMinuteAgo = new Date('2026-10-14T11:59:00.000Z');
  const inOneMinute = new Date('2026-10-14T12:01:00.000Z');

  it('em andamento e com o prazo vencido: atrasado', () => {
    expect(isOverdue({ status: 'IN_PROGRESS', dueAt: oneMinuteAgo }, now)).toBe(true);
  });

  it('prazo vencido, mas já resolvido: não conta como atrasado', () => {
    expect(isOverdue({ status: 'RESOLVED', dueAt: oneMinuteAgo }, now)).toBe(false);
  });

  it('prazo ainda no futuro: não está atrasado', () => {
    expect(isOverdue({ status: 'OPEN', dueAt: inOneMinute }, now)).toBe(false);
  });
});
