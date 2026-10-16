import { z } from 'zod';
import { emailSchema } from '../users/users.schemas.js';

export const loginSchema = z.object({
  email: emailSchema,
  // No login não revelamos a política de senha: só exigimos que algo seja enviado.
  password: z.string().min(1, 'Informe a senha.').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
