import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AuthProvider } from '@/auth/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Tema claro, escuro ou do sistema: a classe .dark no <html>, salva no localStorage.
        A mesma chave é lida por public/theme-init.js antes do React carregar. O script
        inline do next-themes é para SSR; num SPA ele nunca roda, e o type="text/plain"
        o marca como dado inerte (sem o aviso do React 19 sobre <script> em componentes). */}
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="deskflow-theme"
      disableTransitionOnChange
      scriptProps={{ type: 'text/plain' }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </AuthProvider>
        {/* Só no npm run dev: no build de produção, o pacote troca o painel por um componente vazio. */}
        <ReactQueryDevtools buttonPosition="bottom-left" />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
