import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/auth/require-auth';
import { FullPageSpinner } from '@/components/feedback';
import { AppLayout } from '@/components/layout/app-layout';
import { HomeRedirect } from '@/pages/home-redirect';
import { LoginPage } from '@/pages/login-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { RouteErrorPage } from '@/pages/route-error-page';
import { TicketsPage } from '@/pages/tickets/tickets-page';

// Páginas carregadas sob demanda ("lazy"): o código delas vira um arquivo separado,
// baixado só na primeira vez que alguém abre a página. A biblioteca de gráficos, por
// exemplo, só chega ao navegador de quem abre o dashboard.
export const router = createBrowserRouter([
  // Pública
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorPage /> },

  // Tudo abaixo exige sessão
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    // Abrindo direto (ou com F5) uma página sob demanda, o código dela ainda está chegando:
    // enquanto isso, o mesmo indicador de carregamento da sessão.
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'tickets', element: <TicketsPage /> },
          {
            path: 'tickets/:id',
            lazy: async () => ({
              Component: (await import('@/pages/ticket-detail/ticket-detail-page')).TicketDetailPage,
            }),
          },
          {
            element: <RequireAuth roles={['AGENT', 'ADMIN']} />,
            children: [
              {
                path: 'dashboard',
                lazy: async () => ({ Component: (await import('@/pages/dashboard/dashboard-page')).DashboardPage }),
              },
            ],
          },
          {
            element: <RequireAuth roles={['ADMIN']} />,
            children: [
              {
                path: 'users',
                lazy: async () => ({ Component: (await import('@/pages/users/users-page')).UsersPage }),
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
