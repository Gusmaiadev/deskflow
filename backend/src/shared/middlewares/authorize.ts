import type { RequestHandler } from 'express';
import type { Role } from '../../generated/prisma/enums.js';
import { ForbiddenError } from '../errors/app-error.js';
import { getAuthUser } from './authenticate.js';

/** Autorização: decide se o usuário autenticado PODE fazer a ação, pelo perfil. */
export function authorize(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const user = getAuthUser(req);

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError();
    }

    next();
  };
}
