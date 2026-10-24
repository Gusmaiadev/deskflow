import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ApiPage, Ticket, TicketPriority, TicketStatus } from '@/types/api';
import { api } from './client';

export type TicketSort = 'newest' | 'oldest' | 'due' | 'priority';

export type TicketFilters = {
  q?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: string;
  assignee?: string; // "me", "none" ou o id de um técnico
  overdue?: boolean;
  sort: TicketSort;
  page: number;
  pageSize: number;
};

export async function fetchTickets(filters: TicketFilters): Promise<ApiPage<Ticket>> {
  // O axios monta a query string e ignora os valores undefined.
  const { data } = await api.get<ApiPage<Ticket>>('/tickets', { params: filters });
  return data;
}

export function useTickets(filters: TicketFilters) {
  return useQuery({
    // A chave inclui os filtros: cada combinação tem o seu próprio cache.
    queryKey: ['tickets', 'list', filters],
    queryFn: () => fetchTickets(filters),
    // Ao trocar de página, a tabela continua mostrando a página anterior até a nova chegar.
    placeholderData: keepPreviousData,
  });
}
