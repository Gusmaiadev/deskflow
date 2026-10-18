import { z } from 'zod';
import { TicketPriority, TicketStatus } from '../../generated/prisma/enums.js';

const titleSchema = z
  .string()
  .trim()
  .min(5, 'O título precisa ter pelo menos 5 caracteres.')
  .max(150, 'O título pode ter no máximo 150 caracteres.');

const descriptionSchema = z
  .string()
  .trim()
  .min(10, 'Descreva o problema com pelo menos 10 caracteres.')
  .max(5000, 'A descrição pode ter no máximo 5000 caracteres.');

export const ticketIdParamsSchema = z.object({
  id: z.uuid('Identificador de chamado inválido.'),
});

export const listTicketsQuerySchema = z.object({
  status: z.enum(TicketStatus).optional(),
  priority: z.enum(TicketPriority).optional(),
  categoryId: z.uuid('Categoria inválida.').optional(),
  /** "me" = atribuídos a mim; "none" = sem responsável; ou o id de um técnico. */
  assignee: z.union([z.enum(['me', 'none']), z.uuid()]).optional(),
  overdue: z.stringbool().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'due', 'priority']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const createTicketSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  priority: z.enum(TicketPriority).default('MEDIUM'),
  categoryId: z.uuid('Selecione uma categoria válida.'),
});

export const updateTicketSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    status: z.enum(TicketStatus),
    priority: z.enum(TicketPriority),
    categoryId: z.uuid('Selecione uma categoria válida.'),
    assigneeId: z.uuid('Responsável inválido.').nullable(), // null = remover o responsável
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Envie pelo menos um campo para atualizar.');

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type TicketSort = ListTicketsQuery['sort'];
