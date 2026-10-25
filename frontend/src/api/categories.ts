import { useQuery } from '@tanstack/react-query';
import type { ApiData, Category } from '@/types/api';
import { api } from './client';

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<ApiData<Category[]>>('/categories');
  return data.data;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000, // categorias mudam pouco
  });
}
