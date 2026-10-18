import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/authenticate.js';
import { createUserSchema, listUsersQuerySchema, updateUserSchema, userIdParamsSchema } from './users.schemas.js';
import * as usersService from './users.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const filters = listUsersQuerySchema.parse(req.query);
  const users = await usersService.listUsers(filters);

  res.json({ data: users });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = userIdParamsSchema.parse(req.params);
  const user = await usersService.getUser(id);

  res.json({ data: user });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = createUserSchema.parse(req.body);
  const actor = getAuthUser(req);

  const user = await usersService.createUser(actor.id, input);

  res.status(201).json({ data: user });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = userIdParamsSchema.parse(req.params);
  const input = updateUserSchema.parse(req.body);
  const actor = getAuthUser(req);

  const user = await usersService.updateUser(actor.id, id, input);

  res.json({ data: user });
}
