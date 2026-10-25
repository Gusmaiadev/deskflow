import { setAccessToken } from '@/auth/token-store';
import type { ApiData, Session } from '@/types/api';
import { http } from './http';

export type Credentials = { email: string; password: string };

export async function loginRequest(credentials: Credentials): Promise<Session> {
  const { data } = await http.post<ApiData<Session>>('/auth/login', credentials);
  setAccessToken(data.data.accessToken);
  return data.data;
}

export async function logoutRequest(): Promise<void> {
  try {
    await http.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

// --- Refresh: uma renovação de cada vez -------------------------------------------
//
// A API troca o refresh token a cada uso e, se o mesmo token for usado duas vezes,
// encerra a sessão (pode ser um token roubado). Então duas renovações ao mesmo tempo
// derrubariam o usuário. Isso acontece de verdade: várias consultas expiram juntas,
// o React em desenvolvimento roda os efeitos duas vezes, ou duas abas estão abertas.
//
// Proteção 1: dentro da aba, todas as chamadas compartilham a mesma Promise.
// Proteção 2: entre abas, a Web Locks API garante que só uma renova por vez.

let pendingRefresh: Promise<Session> | null = null;

export function refreshSession(): Promise<Session> {
  pendingRefresh ??= withRefreshLock(async () => {
    const { data } = await http.post<ApiData<Session>>('/auth/refresh');
    setAccessToken(data.data.accessToken);
    return data.data;
  })
    .catch((error: unknown) => {
      setAccessToken(null);
      throw error;
    })
    .finally(() => {
      pendingRefresh = null;
    });

  return pendingRefresh;
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  // A Web Locks API só existe em contextos seguros (HTTPS ou localhost).
  if (!('locks' in navigator)) return task();
  return navigator.locks.request('deskflow-refresh', task);
}
