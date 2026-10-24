import { isAxiosError } from 'axios';
import type { ApiErrorBody } from '@/types/api';

/** O código de erro da API (ex.: "INVALID_CREDENTIALS"), se houver. */
export function getErrorCode(error: unknown): string | undefined {
  if (isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.code;
  }
  return undefined;
}

/** Uma mensagem que pode ser mostrada ao usuário, para qualquer tipo de erro. */
export function getErrorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const apiMessage = error.response?.data?.error?.message;
    if (apiMessage) return apiMessage;

    // Sem resposta: a requisição nem chegou à API (sem internet, servidor inalcançável...).
    if (!error.response) return 'Não foi possível falar com o servidor. Verifique sua conexão.';

    // 5xx sem o envelope da API: quem respondeu foi um intermediário (proxy, CloudFront...),
    // porque a API está fora do ar.
    if (error.response.status >= 500) return 'O servidor está indisponível no momento. Tente de novo em instantes.';
  }

  return fallback;
}
