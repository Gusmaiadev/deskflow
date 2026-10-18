import { Router } from 'express';
import { prisma } from '../../database/prisma.js';

export const healthRoutes = Router();

healthRoutes.get('/health', async (_req, res) => {
  let database: 'up' | 'down' = 'up';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = 'down';
    console.error('⚠️ Health check: banco indisponível:', error instanceof Error ? error.message : error);
  }

  const healthy = database === 'up';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    database,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
