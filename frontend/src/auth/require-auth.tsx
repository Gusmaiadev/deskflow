import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/feedback';
import { ForbiddenPage } from '@/pages/forbidden-page';
import type { Role } from '@/types/api';
import { useAuth } from './auth-context';

/**
 * Rota protegida. Sem sessão, manda para o login (lembrando de onde a pessoa veio).
 * Com "roles", só deixa passar esses perfis.
 *
 * Isto melhora a experiência, mas NÃO é a segurança: quem garante o acesso é a API,
 * que confere o token e o perfil em toda requisição.
 */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (roles && !roles.includes(user.role)) return <ForbiddenPage />;

  return <Outlet />;
}
