import type { Role, User } from '../../generated/prisma/client.js';

/** DTO de saída: o formato de usuário que a API devolve. Nunca inclui o hash da senha. */
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
