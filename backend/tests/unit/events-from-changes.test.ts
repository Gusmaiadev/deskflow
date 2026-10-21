import { describe, expect, it } from 'vitest';
import { eventsFromChanges } from '../../src/modules/ticket-events/events-from-changes.js';

describe('eventsFromChanges', () => {
  const ticket = { id: 'chamado-1', status: 'OPEN', priority: 'MEDIUM', assigneeId: null } as const;

  it('registra status, prioridade e responsável que mudaram, com o valor anterior e o novo', () => {
    const changes = { status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: 'tecnico-1' } as const;

    expect(eventsFromChanges(ticket, changes, 'tecnico-1')).toEqual([
      { ticketId: 'chamado-1', actorId: 'tecnico-1', field: 'STATUS', fromValue: 'OPEN', toValue: 'IN_PROGRESS' },
      { ticketId: 'chamado-1', actorId: 'tecnico-1', field: 'PRIORITY', fromValue: 'MEDIUM', toValue: 'HIGH' },
      { ticketId: 'chamado-1', actorId: 'tecnico-1', field: 'ASSIGNEE', fromValue: null, toValue: 'tecnico-1' },
    ]);
  });

  it('não registra valores iguais aos atuais nem os outros campos', () => {
    const changes = { status: 'OPEN', priority: 'MEDIUM', assigneeId: null, title: 'Novo título', dueAt: new Date() } as const;

    expect(eventsFromChanges(ticket, changes, 'tecnico-1')).toEqual([]);
  });

  it('tirar o responsável registra o novo valor como nulo', () => {
    const assigned = { ...ticket, status: 'IN_PROGRESS', assigneeId: 'tecnico-1' } as const;

    expect(eventsFromChanges(assigned, { assigneeId: null }, 'admin-1')).toEqual([
      { ticketId: 'chamado-1', actorId: 'admin-1', field: 'ASSIGNEE', fromValue: 'tecnico-1', toValue: null },
    ]);
  });
});
