import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthService } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ChannelsService } from '../channels/channels.service.js';
import { configureApp } from '../configure-app.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

describe('Message failures (HTTP)', () => {
  let app: INestApplication;
  let token: string;
  let expiresAt: Date;
  const path = '/channels/channel/messages';
  const prisma = {
    authSession: { findUnique: vi.fn() },
    channel: { findUnique: vi.fn() },
    channelMember: { findUnique: vi.fn() },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  // Deliberately fake details must never reach the HTTP response.
  const storageFailure = () =>
    new Error(
      'Connection failed: postgresql://test-user:fake-password@database.invalid/huddle-test',
    );
  const serverError = {
    statusCode: 500,
    message: 'Internal server error',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'message-failure-test-secret' })],
      controllers: [MessagesController],
      providers: [
        MessagesService,
        ChannelsService,
        AuthService,
        JwtAuthGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app, { production: true });
    await app.init();
    expiresAt = new Date((Math.floor(Date.now() / 1000) + 3600) * 1000);
    token = module.get(JwtService).sign({
      sub: 'member',
      jti: 'member-session',
      exp: expiresAt.getTime() / 1000,
    });
  });

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'member-session',
      userId: 'member',
      expiresAt,
    });
    prisma.channel.findUnique.mockResolvedValue({
      id: 'channel',
      isPrivate: false,
    });
    prisma.channelMember.findUnique.mockResolvedValue({ userId: 'member' });
    prisma.message.create.mockResolvedValue({ id: 'unexpected-write' });
    prisma.message.findMany.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns a sanitized server error instead of confirming a failed send', async () => {
    prisma.message.create.mockRejectedValueOnce(storageFailure());
    const response = await request(app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .send({ content: 'Message that could not be stored' })
      .expect(500);

    expect(prisma.message.create).toHaveBeenCalledOnce();
    expect(response.body).toEqual(serverError);
  });

  it('returns a sanitized server error instead of an empty history when reading fails', async () => {
    prisma.message.findMany.mockRejectedValueOnce(storageFailure());
    const response = await request(app.getHttpServer())
      .get(path)
      .auth(token, { type: 'bearer' })
      .expect(500);

    expect(prisma.message.findMany).toHaveBeenCalledOnce();
    expect(response.body).toEqual(serverError);
  });

  it('reports a cursor lookup outage as a sanitized server error, not an invalid cursor', async () => {
    prisma.message.findFirst.mockRejectedValueOnce(storageFailure());
    const response = await request(app.getHttpServer())
      .get(path)
      .query({ before: 'existing-message' })
      .auth(token, { type: 'bearer' })
      .expect(500);

    expect(prisma.message.findFirst).toHaveBeenCalledOnce();
    expect(prisma.message.findMany).not.toHaveBeenCalled();
    expect(response.body).toEqual(serverError);
  });

  it('stops a send when membership cannot be verified because storage is unavailable', async () => {
    prisma.channelMember.findUnique.mockRejectedValueOnce(storageFailure());
    const response = await request(app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .send({ content: 'Do not write without verifying membership' })
      .expect(500);

    expect(prisma.channelMember.findUnique).toHaveBeenCalledOnce();
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(response.body).toEqual(serverError);
  });

  it('rejects an oversized message before attempting a storage write', async () => {
    const response = await request(app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .send({ content: 'x'.repeat(4001) })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message: expect.arrayContaining([
        expect.stringContaining(
          'content must be shorter than or equal to 4000 characters',
        ),
      ]),
    });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('rejects a nonmember without attempting a storage write', async () => {
    prisma.channelMember.findUnique.mockResolvedValueOnce(null);
    const response = await request(app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .send({ content: 'Do not write for a nonmember' })
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Join the channel before sending or reading messages',
    });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});
