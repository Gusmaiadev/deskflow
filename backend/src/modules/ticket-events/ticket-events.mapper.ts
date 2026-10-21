import type { TicketEventField } from '../../generated/prisma/enums.js';
import type { TicketEventWithActor } from './ticket-events.repository.js';

type PersonSummary = { id: string; name: string };

/** DTO de saída de um evento do histórico. */
export type TicketEventResponse = {
  id: string;
  field: TicketEventField;
  /** Status e prioridade: o nome do valor. Responsável: { id, name }, ou null (sem responsável). */
  from: string | PersonSummary | null;
  to: string | PersonSummary | null;
  actor: PersonSummary;
  createdAt: Date;
};

export function toTicketEventResponse(event: TicketEventWithActor, names: Map<string, string>): TicketEventResponse {
  // No responsável, o evento guarda o id do usuário; a resposta já leva o nome. Usuários são
  // desativados, não apagados: o nome só falta se alguém apagar o usuário direto no banco.
  const value = (raw: string | null) =>
    event.field === 'ASSIGNEE' && raw !== null ? { id: raw, name: names.get(raw) ?? 'Usuário removido' } : raw;

  return {
    id: event.id,
    field: event.field,
    from: value(event.fromValue),
    to: value(event.toValue),
    actor: event.actor,
    createdAt: event.createdAt,
  };
}
