import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, notifySessionExpired } from '@/auth/token-store';
import type { ApiErrorBody } from '@/types/api';
import { refreshSession } from './auth';

/** Cliente usado por todas as telas: coloca o token e renova a sessão sozinho. */
export const api = axios.create({ baseURL: '/api' });

// 1) Antes de cada requisição: o access token no cabeçalho Authorization.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Códigos de 401 que um token novo resolve.
const RENEWABLE_CODES = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'MISSING_TOKEN']);

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// 2) Depois de cada resposta: se o token venceu, renova e repete a requisição uma vez.
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError<ApiErrorBody>(error) || !error.config) throw error;

    const original = error.config as RetriableConfig;
    const code = error.response?.data?.error?.code;
    const renewable = error.response?.status === 401 && code !== undefined && RENEWABLE_CODES.has(code);

    if (!renewable || original._retried) throw error;
    original._retried = true;

    try {
      await refreshSession();
    } catch {
      // O refresh também falhou: a sessão acabou de verdade.
      notifySessionExpired();
      throw error;
    }

    return api(original);
  },
);
