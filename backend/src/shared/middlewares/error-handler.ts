import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../errors/app-error.js';

type ErrorBody = { error: { code: string; message: string; details?: unknown } };

/** Erros gerados pelo próprio Express ao ler a requisição (JSON malformado, corpo grande demais, URL inválida...). */
function isHttpError(error: unknown): error is { status: number; type?: string } {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number';
}

/**
 * Último middleware da aplicação: transforma QUALQUER erro em uma resposta JSON
 * no mesmo formato. Detalhes internos nunca vão para o cliente.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  // Se a resposta já começou a ser enviada, só o Express consegue encerrá-la.
  if (res.headersSent) {
    next(error);
    return;
  }

  let status = 500;
  let body: ErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente mais tarde.' },
  };

  if (error instanceof ZodError) {
    status = 400;
    body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Os dados enviados são inválidos.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.') || '(corpo da requisição)',
          message: issue.message,
        })),
      },
    };
  } else if (error instanceof AppError) {
    status = error.statusCode;
    body = { error: { code: error.code, message: error.message, details: error.details } };
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    status = 409;
    body = { error: { code: 'CONFLICT', message: 'Já existe um registro com estes dados.' } };
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    status = 404;
    body = { error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } };
  } else if (isHttpError(error) && error.type === 'entity.parse.failed') {
    status = 400;
    body = { error: { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' } };
  } else if (isHttpError(error) && error.type === 'entity.too.large') {
    status = 413;
    body = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição é grande demais.' } };
  } else if (isHttpError(error) && error.status >= 400 && error.status < 500) {
    // Outros erros do Express ao ler a requisição (%XX inválido na URL, charset não suportado...):
    // o problema está na requisição, então mantemos o status (400, 415...) em vez de responder 500.
    status = error.status;
    body = { error: { code: 'INVALID_REQUEST', message: 'Não foi possível ler a requisição.' } };
  }

  if (status >= 500) {
    // Erro inesperado: registra TUDO no log do servidor, mas responde de forma genérica.
    console.error('❌ Erro não tratado:', error);
  }

  if (status === 401) {
    // Exigido pelo padrão HTTP: diz ao cliente qual esquema de autenticação usar.
    res.set('WWW-Authenticate', 'Bearer');
  }

  res.status(status).json(body);
};
