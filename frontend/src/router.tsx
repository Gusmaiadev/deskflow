import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth } from '@/auth/require-auth';
import { AppLayout } from '@/components/layout/app-layout';
import { LoginPage } from '@/pages/login-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { TicketsPage } from '@/pages/tickets/tickets-page';

export const router = createBrowserRouter([
  // Pública
  { path: '/login', element: <LoginPage /> },

  // Tudo abaixo exige sessão
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/tickets" replace /> },
          { path: 'tickets', element: <TicketsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
