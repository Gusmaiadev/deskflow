import { z } from 'zod';
import { Role } from '../../generated/prisma/enums.js';
import { hasNoNullCharacter, NULL_CHARACTER_MESSAGE } from '../../shared/validation/text.js';

/** E-mail normalizado: sem espaços nas pontas e em minúsculas, antes de validar o formato. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, 'O e-mail pode ter no máximo 255 caracteres.')
  .pipe(z.email('Informe um e-mail válido.'));

const nameSchema = z
  .string()
  .trim()
  .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
  .max(100, 'O nome pode ter no máximo 100 caracteres.')
  .refine(hasNoNullCharacter, NULL_CHARACTER_MESSAGE);

export const newPasswordSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(128, 'A senha pode ter no máximo 128 caracteres.');

export const userIdParamsSchema = z.object({
  // Em minúsculas, como o id do token: o banco aceita o UUID com maiúsculas ou minúsculas,
  // mas o service compara os dois como texto (regra SELF_LOCKOUT).
  id: z.uuid('Identificador de usuário inválido.').toLowerCase(),
});

export const listUsersQuerySchema = z.object({
  role: z.enum(Role).optional(),
});

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  role: z.enum(Role).default('REQUESTER'),
});

export const updateUserSchema = z
  .object({
    name: nameSchema,
    role: z.enum(Role),
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Envie pelo menos um campo para atualizar.');

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
