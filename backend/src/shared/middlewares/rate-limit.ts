import { rateLimit } from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Limite geral da API, por endereço IP. */
export const apiRateLimit = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas requisições. Aguarde alguns minutos.' },
  },
});

/** Limite rígido para o login: dificulta ataques de força bruta contra senhas. */
export const loginRateLimit = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    },
  },
});
