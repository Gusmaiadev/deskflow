import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/authenticate.js';
import { ticketIdParamsSchema } from '../tickets/tickets.schemas.js';
import * as ticketEventsService from './ticket-events.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const { id } = ticketIdParamsSchema.parse(req.params);
  const events = await ticketEventsService.listTicketEvents(getAuthUser(req), id);

  res.json({ data: events });
}
