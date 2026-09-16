import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('Health probes (HTTP)', () => {
  let app: INestApplication;
  const prisma = { $queryRaw: vi.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    prisma.$queryRaw.mockReset();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports liveness without requiring database access or authentication', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { status: 'ok' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness after a successful database query', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200, { status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('returns 503 without database credentials when the database fails', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('postgresql://user:secret@private-db/example'),
    );
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    expect(response.body.message).toBe('Database is unavailable.');
    expect(JSON.stringify(response.body)).not.toMatch(/secret|private-db/);
  });
});
