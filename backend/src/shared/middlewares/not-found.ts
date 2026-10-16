import type { RequestHandler } from 'express';
import { NotFoundError } from '../errors/app-error.js';

/** Executado quando nenhuma rota correspondeu à requisição. */
export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Rota não encontrada: ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND');
};
