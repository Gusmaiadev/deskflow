import express from 'express';
import { healthRoutes } from './modules/health/health.routes.js';
import { errorHandler } from './shared/middlewares/error-handler.js';
import { notFoundHandler } from './shared/middlewares/not-found.js';

export const app = express();

app.use(express.json());

app.use(healthRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
