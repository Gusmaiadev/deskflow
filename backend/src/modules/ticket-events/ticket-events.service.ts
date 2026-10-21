import type { AccessTokenUser } from '../auth/access-token.js';
import { findAccessibleTicket } from '../tickets/tickets.service.js';
import * as usersRepository from '../users/users.repository.js';
import { toTicketEventResponse, type TicketEventResponse } from './ticket-events.mapper.js';
import * as ticketEventsRepository from './ticket-events.repository.js';

type Actor = AccessTokenUser;

export async function listTicketEvents(actor: Actor, ticketId: string): Promise<TicketEventResponse[]> {
  // Reaproveita a regra de acesso dos chamados: quem não vê o chamado, não vê o histórico.
  await findAccessibleTicket(actor, ticketId);

  const events = await ticketEventsRepository.listByTicket(ticketId);

  // O evento do responsável guarda só o id: busca os nomes de uma vez, para o anterior e o novo.
  const assigneeIds = events
    .filter((event) => event.field === 'ASSIGNEE')
    .flatMap((event) => [event.fromValue, event.toValue])
    .filter((id) => id !== null);
  const users = assigneeIds.length > 0 ? await usersRepository.findNames([...new Set(assigneeIds)]) : [];
  const names = new Map(users.map((user) => [user.id, user.name]));

  return events.map((event) => toTicketEventResponse(event, names));
}
