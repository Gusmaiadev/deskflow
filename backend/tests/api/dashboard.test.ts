import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

describe('GET /api/dashboard', () => {
  it('é restrito à equipe de suporte', async () => {
    const response = await request(app).get('/api/dashboard').set(await authHeader('ana@test.example'));

    expect(response.status).toBe(403);
  });

  it('conta os chamados em andamento, atrasados e sem responsável', async () => {
    const now = Date.now();
    const base = { description: 'Descrição de teste.', categoryId: data.category.id, requesterId: data.ana.id };

    await prisma.ticket.createMany({
      data: [
        { ...base, title: 'Atrasado', priority: 'URGENT', createdAt: new Date(now - 5 * 3_600_000), dueAt: new Date(now - 3_600_000) },
        { ...base, title: 'No prazo', priority: 'LOW', createdAt: new Date(now), dueAt: new Date(now + 72 * 3_600_000) },
      ],
    });

    const response = await request(app).get('/api/dashboard').set(await authHeader('agent@test.example'));

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({ open: 2, overdue: 1, unassigned: 2, resolvedLast30Days: 0 });
    expect(response.body.data.openByPriority).toEqual({ LOW: 1, MEDIUM: 0, HIGH: 0, URGENT: 1 });
    expect(response.body.data.sla.compliancePercent).toBeNull();
    expect(response.body.data.createdPerDay).toHaveLength(7);
  });
});
