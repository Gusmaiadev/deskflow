import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/authenticate.js';
import { createCommentSchema, ticketParamsSchema } from './comments.schemas.js';
import * as commentsService from './comments.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const { ticketId } = ticketParamsSchema.parse(req.params);
  const comments = await commentsService.listComments(getAuthUser(req), ticketId);

  res.json({ data: comments });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { ticketId } = ticketParamsSchema.parse(req.params);
  const input = createCommentSchema.parse(req.body);
  const comment = await commentsService.addComment(getAuthUser(req), ticketId, input);

  res.status(201).json({ data: comment });
}
