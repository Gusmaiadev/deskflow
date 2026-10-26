import { createContext, useContext } from 'react';
import type { Credentials } from '@/api/auth';
import type { User } from '@/types/api';

// signed-out: a pessoa saiu pelo menu (anonymous: nunca entrou, ou a sessão acabou sozinha).
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'signed-out';

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
