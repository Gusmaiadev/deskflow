import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiData, Role, User } from '@/types/api';
import { api } from './client';

export type NewUser = { name: string; email: string; password: string; role: Role };
export type UserChanges = { role?: Role; isActive?: boolean };

const usersKey = ['users', 'list'] as const;

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get<ApiData<User[]>>('/users');
  return data.data;
}

export async function createUser(input: NewUser): Promise<User> {
  const { data } = await api.post<ApiData<User>>('/users', input);
  return data.data;
}

export async function updateUser(id: string, changes: UserChanges): Promise<User> {
  const { data } = await api.patch<ApiData<User>>(`/users/${id}`, changes);
  return data.data;
}

/** Todos os usuários (tela de administração). */
export function useUsers() {
  return useQuery({ queryKey: usersKey, queryFn: fetchUsers });
}

/** A equipe de suporte (técnicos e admins ativos), para filtros e atribuição. */
export function useStaff(enabled: boolean) {
  return useQuery({
    queryKey: usersKey, // o mesmo cache da lista completa; o "select" filtra
    queryFn: fetchUsers,
    select: (users) => users.filter((user) => user.isActive && user.role !== 'REQUESTER'),
    staleTime: 5 * 60_000,
    // Solicitantes não podem listar usuários: a consulta nem é feita para eles.
    enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UserChanges }) => updateUser(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}
