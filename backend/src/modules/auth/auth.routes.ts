import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { loginRateLimit } from '../../shared/middlewares/rate-limit.js';
import * as authController from './auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/login', loginRateLimit, authController.login);
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authenticate, authController.me);
