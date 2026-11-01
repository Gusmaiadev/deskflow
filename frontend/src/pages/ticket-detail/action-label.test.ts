import { describe, expect, it } from 'vitest';
import type { PersonSummary, TicketStatus } from '@/types/api';
import { actionLabel } from './action-label';

const rafael: PersonSummary = { id: 'agent-1', name: 'Rafael Lima' };

// Cada transição que a API permite (ticket-rules.ts, no backend) tem o seu texto.
describe('actionLabel', () => {
  it.each<[TicketStatus, TicketStatus, string]>([
    ['OPEN', 'RESOLVED', 'Marcar como resolvido'],
    ['OPEN', 'CLOSED', 'Fechar chamado'],
    ['IN_PROGRESS', 'OPEN', 'Devolver para a fila'],
    ['IN_PROGRESS', 'WAITING_REQUESTER', 'Pedir informação ao solicitante'],
    ['IN_PROGRESS', 'RESOLVED', 'Marcar como resolvido'],
    ['WAITING_REQUESTER', 'IN_PROGRESS', 'Retomar atendimento'],
    ['WAITING_REQUESTER', 'RESOLVED', 'Marcar como resolvido'],
    ['RESOLVED', 'IN_PROGRESS', 'Retomar atendimento'],
    ['RESOLVED', 'CLOSED', 'Fechar chamado'],
  ])('equipe: de %s para %s, "%s"', (from, to, label) => {
    expect(actionLabel({ status: from, assignee: rafael }, to, true)).toBe(label);
  });

  it('equipe: um chamado aberto sem responsável é assumido; com responsável, o atendimento é iniciado', () => {
    expect(actionLabel({ status: 'OPEN', assignee: null }, 'IN_PROGRESS', true)).toBe('Assumir chamado');
    expect(actionLabel({ status: 'OPEN', assignee: rafael }, 'IN_PROGRESS', true)).toBe('Iniciar atendimento');
  });

  it.each<[TicketStatus, TicketStatus, string]>([
    ['OPEN', 'CLOSED', 'Cancelar chamado'],
    ['RESOLVED', 'IN_PROGRESS', 'O problema continua'],
    ['RESOLVED', 'CLOSED', 'Confirmar solução'],
  ])('solicitante: de %s para %s, "%s"', (from, to, label) => {
    expect(actionLabel({ status: from, assignee: rafael }, to, false)).toBe(label);
  });
});
