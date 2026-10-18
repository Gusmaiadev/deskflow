import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { errorHandler } from './shared/middlewares/error-handler.js';
import { notFoundHandler } from './shared/middlewares/not-found.js';
import { apiRateLimit } from './shared/middlewares/rate-limit.js';

export const app = express();

// 1) Proteções que valem para toda requisição
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
app.use('/api', apiRateLimit);

// 2) Leitura da requisição
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// 3) Rotas
app.use(healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

// 4) Rota inexistente e tratamento de erros (sempre por último)
app.use(notFoundHandler);
app.use(errorHandler);
