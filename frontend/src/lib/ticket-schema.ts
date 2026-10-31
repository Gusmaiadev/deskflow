import { z } from 'zod';

// As mesmas regras do titleSchema e do descriptionSchema do backend (Dia 4),
// usadas ao abrir e ao editar um chamado.
export const ticketTitleSchema = z
  .string()
  .trim()
  .min(5, 'O título precisa ter pelo menos 5 caracteres.')
  .max(150, 'O título pode ter no máximo 150 caracteres.');

export const ticketDescriptionSchema = z
  .string()
  .trim()
  .min(10, 'Descreva o problema com pelo menos 10 caracteres.')
  .max(5000, 'A descrição pode ter no máximo 5000 caracteres.');
