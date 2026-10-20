import { z } from 'zod';

const nameSchema = z
  .string()
  .trim()
  .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
  .max(60, 'O nome pode ter no máximo 60 caracteres.');

const descriptionSchema = z.string().trim().max(255, 'A descrição pode ter no máximo 255 caracteres.');

export const categoryIdParamsSchema = z.object({
  // Em minúsculas, como os ids que vêm do banco: o service compara os dois como texto.
  id: z.uuid('Identificador de categoria inválido.').toLowerCase(),
});

export const createCategorySchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional(),
});

export const updateCategorySchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.nullable(), // null apaga a descrição
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Envie pelo menos um campo para atualizar.');

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
