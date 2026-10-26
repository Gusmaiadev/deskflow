import { Navigate } from 'react-router';
import { useAuth } from '@/auth/auth-context';

/** A página inicial depende do perfil: a equipe vê o dashboard; o solicitante, os seus chamados. */
export function HomeRedirect() {
  const { user } = useAuth();
  const isStaff = user?.role === 'AGENT' || user?.role === 'ADMIN';

  return <Navigate to={isStaff ? '/dashboard' : '/tickets'} replace />;
}
