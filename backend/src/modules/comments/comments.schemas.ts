import { z } from 'zod';
import { hasNoNullCharacter, NULL_CHARACTER_MESSAGE } from '../../shared/validation/text.js';

export const ticketParamsSchema = z.object({
  ticketId: z.uuid('Identificador de chamado inválido.').toLowerCase(),
});

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Escreva o comentário.')
    .max(5000, 'O comentário pode ter no máximo 5000 caracteres.')
    .refine(hasNoNullCharacter, NULL_CHARACTER_MESSAGE),
  isInternal: z.boolean().default(false),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
