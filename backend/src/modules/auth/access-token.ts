import { errors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { Role } from '../../generated/prisma/enums.js';
import { UnauthorizedError } from '../../shared/errors/app-error.js';

const ISSUER = 'deskflow-api';
const AUDIENCE = 'deskflow-web';
const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export const ACCESS_TOKEN_TTL_SECONDS = env.JWT_ACCESS_TTL_MINUTES * 60;

export type AccessTokenUser = { id: string; role: Role };

const payloadSchema = z.object({
  sub: z.uuid(),
  role: z.enum(Role),
});

/** Cria o JWT de acesso: curto, assinado e com o mínimo de dados necessário. */
export function signAccessToken(user: AccessTokenUser): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL_MINUTES}m`)
    .sign(secret);
}

/** Confere assinatura, emissor, público, algoritmo e validade. Devolve quem é o usuário. */
export async function verifyAccessToken(token: string): Promise<AccessTokenUser> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const { sub, role } = payloadSchema.parse(payload);
    return { id: sub, role };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new UnauthorizedError('Token de acesso expirado.', 'TOKEN_EXPIRED');
    }
    throw new UnauthorizedError('Token de acesso inválido.', 'INVALID_TOKEN');
  }
}
