import { z } from 'zod';
import { emailSchema, newPasswordSchema } from '../users/users.schemas.js';

export const loginSchema = z.object({
  email: emailSchema,
  // No login não revelamos a política de senha: só exigimos que algo seja enviado.
  password: z.string().min(1, 'Informe a senha.').max(128),
});

export const changePasswordSchema = z
  .object({
    // A senha atual só é conferida; a política de senha vale para a nova.
    currentPassword: z.string().min(1, 'Informe a senha atual.').max(128),
    newPassword: newPasswordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: 'A nova senha precisa ser diferente da atual.',
    path: ['newPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
