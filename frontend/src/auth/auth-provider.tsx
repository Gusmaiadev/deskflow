import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { loginRequest, logoutRequest, refreshSession, type Credentials } from '@/api/auth';
import type { User } from '@/types/api';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';
import { onSessionExpired } from './token-store';

type AuthState = { status: AuthStatus; user: User | null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  // Ao abrir (ou recarregar) o site: tenta recuperar a sessão pelo cookie do refresh token.
  useEffect(() => {
    let active = true;

    refreshSession()
      .then((session) => {
        if (active) setState({ status: 'authenticated', user: session.user });
      })
      .catch(() => {
        if (active) setState({ status: 'anonymous', user: null });
      });

    return () => {
      active = false;
    };
  }, []);

  // Se o refresh falhar no meio do uso (sessão expirada ou encerrada), volta para o login.
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear();
        setState({ status: 'anonymous', user: null });
        // O id evita vários avisos iguais quando várias consultas falham juntas.
        toast.error('Sua sessão expirou. Entre novamente.', { id: 'session-expired' });
      }),
    [queryClient],
  );

  const login = useCallback(
    async (credentials: Credentials) => {
      const session = await loginRequest(credentials);
      queryClient.clear(); // nada do usuário anterior pode aparecer para o novo
      setState({ status: 'authenticated', user: session.user });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      queryClient.clear();
      setState({ status: 'signed-out', user: null });
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ status: state.status, user: state.user, login, logout }),
    [state, login, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
