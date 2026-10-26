import { useQuery } from '@tanstack/react-query';
import type { ApiData, Dashboard } from '@/types/api';
import { api } from './client';

export async function fetchDashboard(): Promise<Dashboard> {
  const { data } = await api.get<ApiData<Dashboard>>('/dashboard');
  return data.data;
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    // Um painel aberto numa tela da equipe se atualiza sozinho a cada minuto.
    refetchInterval: 60_000,
  });
}
