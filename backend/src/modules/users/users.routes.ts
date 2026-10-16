import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import * as usersController from './users.controller.js';

export const usersRoutes = Router();

// Todas as rotas de usuários exigem login.
usersRoutes.use(authenticate);

usersRoutes.get('/', authorize('ADMIN', 'AGENT'), usersController.list);
usersRoutes.post('/', authorize('ADMIN'), usersController.create);
usersRoutes.patch('/:id', authorize('ADMIN'), usersController.update);
