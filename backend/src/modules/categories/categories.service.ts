import type { Role } from '../../generated/prisma/enums.js';
import { env } from '../../config/env.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error.js';
import * as categoriesRepository from './categories.repository.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schemas.js';

/** O admin vê todas; os demais perfis só veem as ativas (as que podem receber chamados). */
export function listCategories(actorRole: Role) {
  return categoriesRepository.list({ onlyActive: actorRole !== 'ADMIN' });
}

export async function createCategory(input: CreateCategoryInput) {
  const existing = await categoriesRepository.findByName(input.name);

  if (existing) {
    throw new ConflictError('Já existe uma categoria com este nome.', 'CATEGORY_NAME_IN_USE');
  }

  return categoriesRepository.create(input);
}

export async function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  const current = await categoriesRepository.findById(categoryId);

  if (!current) {
    throw new NotFoundError('Categoria não encontrada.', 'CATEGORY_NOT_FOUND');
  }

  // Sem as categorias originais ativas, ninguém abriria chamados na demo até o reset da meia-noite.
  if (env.DEMO_CATEGORY_NAMES.includes(current.name.toLowerCase())) {
    throw new ForbiddenError('As categorias da demonstração não podem ser alteradas.', 'DEMO_CATEGORY');
  }

  if (input.name !== undefined) {
    const sameName = await categoriesRepository.findByName(input.name);

    if (sameName && sameName.id !== categoryId) {
      throw new ConflictError('Já existe uma categoria com este nome.', 'CATEGORY_NAME_IN_USE');
    }
  }

  return categoriesRepository.update(categoryId, input);
}
