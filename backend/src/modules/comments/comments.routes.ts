import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import * as commentsController from './comments.controller.js';

// mergeParams: dá acesso ao :ticketId, que está no caminho onde este router é montado.
export const commentsRoutes = Router({ mergeParams: true });

commentsRoutes.use(authenticate);

commentsRoutes.get('/', commentsController.list);
commentsRoutes.post('/', commentsController.create);
