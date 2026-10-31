import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiData, Category } from '@/types/api';
import { api } from './client';

export type NewCategory = { name: string; description?: string };
export type CategoryChanges = { name?: string; description?: string | null; isActive?: boolean }; // null apaga a descrição

const categoriesKey = ['categories'] as const;

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<ApiData<Category[]>>('/categories');
  return data.data;
}

export async function createCategory(input: NewCategory): Promise<Category> {
  const { data } = await api.post<ApiData<Category>>('/categories', input);
  return data.data;
}

export async function updateCategory(id: string, changes: CategoryChanges): Promise<Category> {
  const { data } = await api.patch<ApiData<Category>>(`/categories/${id}`, changes);
  return data.data;
}

/** As categorias ativas; o admin recebe também as desativadas. */
export function useCategories() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: fetchCategories,
    staleTime: 5 * 60_000, // categorias mudam pouco
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesKey }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: CategoryChanges }) => updateCategory(id, changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKey });
      // O nome da categoria aparece nos chamados e no gráfico do dashboard.
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
