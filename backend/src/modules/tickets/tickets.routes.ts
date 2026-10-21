import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import * as ticketEventsController from '../ticket-events/ticket-events.controller.js';
import * as ticketsController from './tickets.controller.js';

export const ticketsRoutes = Router();

// Todos os perfis usam estas rotas; o que cada um vê e pode fazer é decidido no service.
ticketsRoutes.use(authenticate);

ticketsRoutes.get('/', ticketsController.list);
ticketsRoutes.post('/', ticketsController.create);
ticketsRoutes.get('/:id', ticketsController.getById);
ticketsRoutes.patch('/:id', ticketsController.update);
ticketsRoutes.get('/:id/events', ticketEventsController.list); // histórico (módulo ticket-events)
