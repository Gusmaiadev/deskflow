import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import * as categoriesController from './categories.controller.js';

export const categoriesRoutes = Router();

categoriesRoutes.use(authenticate);

categoriesRoutes.get('/', categoriesController.list);
categoriesRoutes.post('/', authorize('ADMIN'), categoriesController.create);
categoriesRoutes.patch('/:id', authorize('ADMIN'), categoriesController.update);
