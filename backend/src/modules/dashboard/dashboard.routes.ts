import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import * as dashboardController from './dashboard.controller.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/', authenticate, authorize('AGENT', 'ADMIN'), dashboardController.get);
