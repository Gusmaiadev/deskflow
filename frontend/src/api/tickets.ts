import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiData, ApiPage, Ticket, TicketDetail, TicketPriority, TicketStatus } from '@/types/api';
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

export type NewTicket = {
  title: string;
  description: string;
  priority: TicketPriority;
  categoryId: string;
};

export type TicketChanges = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string | null; // null = remover o responsável
};

// As chaves do cache em um lugar só. Todas começam com "tickets", então
// invalidar ['tickets'] atinge listas, detalhes e comentários de uma vez.
export const ticketKeys = {
  lists: ['tickets', 'list'] as const,
  list: (filters: TicketFilters) => ['tickets', 'list', filters] as const,
  detail: (id: string) => ['tickets', 'detail', id] as const,
  comments: (id: string) => ['tickets', 'detail', id, 'comments'] as const,
};

export async function fetchTickets(filters: TicketFilters): Promise<ApiPage<Ticket>> {
  // O axios monta a query string e ignora os valores undefined.
  const { data } = await api.get<ApiPage<Ticket>>('/tickets', { params: filters });
  return data;
}

export async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data } = await api.get<ApiData<TicketDetail>>(`/tickets/${id}`);
  return data.data;
}

export async function createTicket(input: NewTicket): Promise<Ticket> {
  const { data } = await api.post<ApiData<Ticket>>('/tickets', input);
  return data.data;
}

export async function updateTicket(id: string, changes: TicketChanges): Promise<TicketDetail> {
  const { data } = await api.patch<ApiData<TicketDetail>>(`/tickets/${id}`, changes);
  return data.data;
}

/** Chave e busca de uma página da lista, compartilhadas pelo useTickets e pelo pré-carregamento. */
export function ticketsQueryOptions(filters: TicketFilters) {
  return queryOptions({
    // A chave inclui os filtros: cada combinação tem o seu próprio cache.
    queryKey: ticketKeys.list(filters),
    queryFn: () => fetchTickets(filters),
  });
}

export function useTickets(filters: TicketFilters) {
  return useQuery({
    ...ticketsQueryOptions(filters),
    // Ao trocar de página, a tabela continua mostrando a página anterior até a nova chegar.
    placeholderData: keepPreviousData,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => fetchTicket(id),
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    // Um chamado novo muda as listas e o dashboard: o cache deles deixa de valer.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.lists });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateTicket(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: TicketChanges) => updateTicket(id, changes),
    onSuccess: (ticket) => {
      // A API já devolveu o chamado atualizado: ele entra direto no cache, sem nova consulta.
      queryClient.setQueryData(ticketKeys.detail(id), ticket);
      void queryClient.invalidateQueries({ queryKey: ticketKeys.lists });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    // Recusado (outra pessoa alterou o chamado ao mesmo tempo, 409 TICKET_CHANGED, ou ele
    // mudou de status): a tela busca o chamado de novo, em vez de ficar com a versão velha.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
    },
  });
}
