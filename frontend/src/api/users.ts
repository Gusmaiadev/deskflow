import { useQuery } from '@tanstack/react-query';
import type { ApiData, User } from '@/types/api';
import { api } from './client';

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get<ApiData<User[]>>('/users');
  return data.data;
}

/** A equipe de suporte (técnicos e admins ativos), para filtros e atribuição. */
export function useStaff(enabled: boolean) {
  return useQuery({
    queryKey: ['users', 'list'],
    queryFn: fetchUsers,
    select: (users) => users.filter((user) => user.isActive && user.role !== 'REQUESTER'),
    staleTime: 5 * 60_000,
    // Solicitantes não podem listar usuários: a consulta nem é feita para eles.
    enabled,
  });
}
