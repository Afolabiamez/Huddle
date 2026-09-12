import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthService } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';

describe('Channel visibility (HTTP)', () => {
  let app: INestApplication;
  let memberToken: string;
  let outsiderToken: string;
  const channels = [
    { id: 'private-channel', isPrivate: true, _count: { members: 1 } },
    { id: 'public-channel', isPrivate: false, _count: { members: 1 } },
  ];
  const expiresAt = new Date((Math.floor(Date.now() / 1000) + 3600) * 1000);
  const prisma = {
    authSession: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const userId = where.id.replace(/-session$/, '');
        return ['member', 'outsider'].includes(userId)
          ? { id: where.id, userId, expiresAt }
          : null;
      }),
    },
    channel: {
      findUnique: vi.fn(
        ({ where }: { where: { id: string } }) =>
          channels.find((channel) => channel.id === where.id) ?? null,
      ),
    },
    channelMember: {
      findUnique: vi.fn(
        ({ where }: { where: { channelId_userId: { userId: string } } }) =>
          where.channelId_userId.userId === 'member'
            ? { userId: 'member' }
            : null,
      ),
      findMany: vi.fn(() => [{ userId: 'member' }]),
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'channel-visibility-test-secret' }),
      ],
      controllers: [ChannelsController],
      providers: [
        ChannelsService,
        AuthService,
        JwtAuthGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    const jwt = module.get(JwtService);
    memberToken = jwt.sign({
      sub: 'member',
      jti: 'member-session',
      exp: expiresAt.getTime() / 1000,
    });
    outsiderToken = jwt.sign({
      sub: 'outsider',
      jti: 'outsider-session',
      exp: expiresAt.getTime() / 1000,
    });
  });

  beforeEach(() => vi.clearAllMocks());

  afterAll(async () => {
    await app?.close();
  });

  describe.each(['', '/members'])('GET /channels/:id%s', (suffix) => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/channels/private-channel${suffix}`)
        .expect(401);
    });

    it('allows a member to access a private channel', async () => {
      await request(app.getHttpServer())
        .get(`/channels/private-channel${suffix}`)
        .auth(memberToken, { type: 'bearer' })
        .expect(200);
    });

    it('denies a nonmember access to a private channel', async () => {
      await request(app.getHttpServer())
        .get(`/channels/private-channel${suffix}`)
        .auth(outsiderToken, { type: 'bearer' })
        .expect(403);
      expect(prisma.channelMember.findMany).not.toHaveBeenCalled();
    });

    it('allows a nonmember to discover a public channel', async () => {
      await request(app.getHttpServer())
        .get(`/channels/public-channel${suffix}`)
        .auth(outsiderToken, { type: 'bearer' })
        .expect(200);
    });

    it('returns 404 for a missing channel', async () => {
      await request(app.getHttpServer())
        .get(`/channels/missing${suffix}`)
        .auth(memberToken, { type: 'bearer' })
        .expect(404);
    });
  });
});
