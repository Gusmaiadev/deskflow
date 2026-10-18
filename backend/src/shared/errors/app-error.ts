/**
 * Erro "esperado" da aplicação: algo que o cliente fez de errado ou que
 * a regra de negócio não permite. Carrega o status HTTP e um código estável,
 * que o frontend pode usar para decidir o que fazer.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(400, code, message);
  }
}

/** 401: não sabemos quem você é (sem token, token inválido ou expirado). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Autenticação necessária.', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

/** 403: sabemos quem você é, mas você não tem permissão. */
export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para esta ação.', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, code, message);
  }
}
