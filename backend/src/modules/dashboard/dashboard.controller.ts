import type { Request, Response } from 'express';
import * as dashboardService from './dashboard.service.js';

export async function get(_req: Request, res: Response): Promise<void> {
  const dashboard = await dashboardService.getDashboard();

  res.json({ data: dashboard });
}
