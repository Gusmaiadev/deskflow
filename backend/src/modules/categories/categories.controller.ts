import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/authenticate.js';
import { categoryIdParamsSchema, createCategorySchema, updateCategorySchema } from './categories.schemas.js';
import * as categoriesService from './categories.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const { role } = getAuthUser(req);
  const categories = await categoriesService.listCategories(role);

  res.json({ data: categories });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = createCategorySchema.parse(req.body);
  const category = await categoriesService.createCategory(input);

  res.status(201).json({ data: category });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = categoryIdParamsSchema.parse(req.params);
  const input = updateCategorySchema.parse(req.body);
  const category = await categoriesService.updateCategory(id, input);

  res.json({ data: category });
}
