import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/authenticate.js';
import {
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamsSchema,
  updateTicketSchema,
} from './tickets.schemas.js';
import * as ticketsService from './tickets.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = listTicketsQuerySchema.parse(req.query);
  const page = await ticketsService.listTickets(getAuthUser(req), query);

  res.json(page);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = ticketIdParamsSchema.parse(req.params);
  const ticket = await ticketsService.getTicket(getAuthUser(req), id);

  res.json({ data: ticket });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = createTicketSchema.parse(req.body);
  const ticket = await ticketsService.createTicket(getAuthUser(req), input);

  res.status(201).json({ data: ticket });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = ticketIdParamsSchema.parse(req.params);
  const input = updateTicketSchema.parse(req.body);
  const ticket = await ticketsService.updateTicket(getAuthUser(req), id, input);

  res.json({ data: ticket });
}
