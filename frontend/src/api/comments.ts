import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiData, Comment } from '@/types/api';
import { api } from './client';
import { ticketKeys } from './tickets';

export type NewComment = { body: string; isInternal: boolean };

export async function fetchComments(ticketId: string): Promise<Comment[]> {
  const { data } = await api.get<ApiData<Comment[]>>(`/tickets/${ticketId}/comments`);
  return data.data;
}

export async function createComment(ticketId: string, input: NewComment): Promise<Comment> {
  const { data } = await api.post<ApiData<Comment>>(`/tickets/${ticketId}/comments`, input);
  return data.data;
}

export function useComments(ticketId: string) {
  return useQuery({
    queryKey: ticketKeys.comments(ticketId),
    queryFn: () => fetchComments(ticketId),
  });
}

export function useCreateComment(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewComment) => createComment(ticketId, input),
    // A resposta do solicitante pode mudar o status do chamado (Dia 4): invalidar o
    // detalhe atualiza o chamado E os comentários, porque a chave deles começa igual.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.lists });
    },
    // Recusado porque o chamado mudou enquanto a pessoa escrevia (409): a tela mostra o estado atual.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) });
    },
  });
}
