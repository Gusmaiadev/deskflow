import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Por 30 segundos, um dado já buscado é considerado novo: trocar de tela e voltar não refaz a busca.
      staleTime: 30_000,
      // Erros 4xx (sem permissão, não encontrado...) não melhoram tentando de novo. Falhas de rede, sim.
      retry: (failureCount, error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});
