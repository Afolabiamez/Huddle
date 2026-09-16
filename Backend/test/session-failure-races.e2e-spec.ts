import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

type User = { id: string; email: string; token: string };

describe('Session failure and invitation races (PostgreSQL E2E)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let prisma: PrismaService;
  let owner: User;
  let guest: User;
  const password = 'Session-failure-test-password!';
  const fixturePrefix = `edge-${randomBytes(8).toString('hex')}`;
  const name = () => `${fixturePrefix}-${randomBytes(4).toString('hex')}`;
  const emails = new Set<string>();
  const channelIds: string[] = [];

  const signup = async (email = `${name()}@example.test`): Promise<User> => {
    emails.add(email);
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password })
      .expect(201);
    return response.body;
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app, { authRateLimit: { limit: 1000 } });
    await app.init();
    prisma = module.get(PrismaService);
    owner = await signup();
    guest = await signup();
  });

  afterAll(async () => {
    try {
      if (prisma) {
        // Delete only this suite's fixtures; other files share the runner's schema.
        await prisma.channelMember.deleteMany({
          where: { channelId: { in: channelIds } },
        });
        await prisma.channel.deleteMany({
          where: { id: { in: channelIds } },
        });
        await prisma.user.deleteMany({
          where: { email: { in: [...emails] } },
        });
      }
    } finally {
      if (app) await app.close();
      else await module?.close();
    }
  });

  it('rejects malformed bearer headers through HTTP and accepts a mixed-case scheme', async () => {
    for (const header of [
      'Bearer',
      `Bearer  ${owner.token}`,
      `Basic ${owner.token}`,
      `Bearer ${owner.token} another-token`,
      'Bearer invalid.token.value',
    ]) {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', header)
        .expect(401);
    }
    const currentUser = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `bEaReR ${owner.token}`)
      .expect(200);
    expect(currentUser.body).toEqual({ id: owner.id, email: owner.email });
  });

  it('rolls back the inserted user when PostgreSQL rejects session creation and allows retry', async () => {
    const email = `${name()}@example.test`;
    emails.add(email);
    const nonexistentUserId = `missing-${name()}`;
    let insertedUserId: string | undefined;
    let attemptedSessionId: string | undefined;
    let databaseErrorCode: string | undefined;
    let faultCount = 0;
    const realTransaction = prisma.$transaction.bind(prisma);

    // Keep the actual interactive transaction. Only this app instance's next
    // session INSERT is changed to violate PostgreSQL's user foreign key.
    const transactionSpy = vi
      .spyOn(prisma, '$transaction')
      .mockImplementationOnce((operation, options) =>
        realTransaction(async (transaction) => {
          const faultingTransaction = new Proxy(transaction, {
            get(target, property, receiver) {
              if (property !== 'authSession')
                return Reflect.get(target, property, receiver);
              return new Proxy(target.authSession, {
                get(sessions, sessionProperty, sessionReceiver) {
                  if (sessionProperty !== 'create')
                    return Reflect.get(
                      sessions,
                      sessionProperty,
                      sessionReceiver,
                    );
                  return async (args: Prisma.AuthSessionCreateArgs) => {
                    const userId = args.data.userId;
                    if (typeof userId !== 'string')
                      throw new Error('Expected the signup user ID.');
                    const insertedUser =
                      await transaction.user.findUniqueOrThrow({
                        where: { id: userId },
                      });
                    if (insertedUser.email !== email)
                      throw new Error('Fault injection reached another user.');
                    insertedUserId = insertedUser.id;
                    attemptedSessionId = args.data.id;
                    faultCount += 1;
                    try {
                      return await sessions.create({
                        data: {
                          id: args.data.id,
                          userId: nonexistentUserId,
                          expiresAt: args.data.expiresAt,
                        },
                      });
                    } catch (error) {
                      if (error instanceof Prisma.PrismaClientKnownRequestError)
                        databaseErrorCode = error.code;
                      throw error;
                    }
                  };
                },
              });
            },
          });
          return operation(faultingTransaction);
        }, options),
      );

    try {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password })
        .expect(500);
      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(faultCount).toBe(1);
      expect(databaseErrorCode).toBe('P2003');
      expect(insertedUserId).toEqual(expect.any(String));
      expect(attemptedSessionId).toEqual(expect.any(String));
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      expect(
        await prisma.authSession.count({
          where: {
            OR: [
              { id: attemptedSessionId },
              { userId: insertedUserId },
              { userId: nonexistentUserId },
            ],
          },
        }),
      ).toBe(0);
    } finally {
      transactionSpy.mockRestore();
    }

    const retried = await signup(email);
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(retried.token, { type: 'bearer' })
      .expect(200)
      .expect({ id: retried.id, email });
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(
      await prisma.authSession.count({ where: { userId: retried.id } }),
    ).toBe(1);
  });

  it.each([1, 2, 3, 4])(
    'keeps renewal and revocation consistent under concurrent requests (round %i)',
    async () => {
      const channel = await request(app.getHttpServer())
        .post('/channels')
        .auth(owner.token, { type: 'bearer' })
        .send({ name: name(), isPrivate: true })
        .expect(201);
      const channelId = channel.body.id as string;
      channelIds.push(channelId);
      const invitationPath = `/channels/${channelId}/invitations`;
      const invitation = await request(app.getHttpServer())
        .post(invitationPath)
        .auth(owner.token, { type: 'bearer' })
        .send({ userId: guest.id })
        .expect(201);
      await prisma.channelInvitation.update({
        where: { id: invitation.body.id },
        data: { expiresAt: new Date(0) },
      });

      const [renewed, revoked] = await Promise.all([
        request(app.getHttpServer())
          .post(invitationPath)
          .auth(owner.token, { type: 'bearer' })
          .send({ userId: guest.id }),
        request(app.getHttpServer())
          .delete(`${invitationPath}/${invitation.body.id}`)
          .auth(owner.token, { type: 'bearer' }),
      ]);
      expect(renewed.status).toBe(201);
      expect(revoked.status).toBe(204);
      expect(renewed.body).toMatchObject({
        channelId,
        inviteeId: guest.id,
        invitedById: owner.id,
        acceptedAt: null,
      });
      expect(new Date(renewed.body.expiresAt).getTime()).toBeGreaterThan(
        Date.now(),
      );

      const remaining = await prisma.channelInvitation.findMany({
        where: { channelId, inviteeId: guest.id },
      });
      const pending = await request(app.getHttpServer())
        .get('/channel-invitations')
        .auth(guest.token, { type: 'bearer' })
        .expect(200);
      const visible = pending.body.filter(
        (item: { channelId: string }) => item.channelId === channelId,
      );
      if (renewed.body.id === invitation.body.id) {
        // Renewal acquired the row first, then revocation removed it.
        expect(remaining).toEqual([]);
        expect(visible).toEqual([]);
      } else {
        // Revocation removed the expired row first; the request created a new one.
        expect(remaining).toHaveLength(1);
        expect(JSON.parse(JSON.stringify(remaining[0]))).toEqual(renewed.body);
        expect(visible).toHaveLength(1);
        expect(visible[0]).toMatchObject(renewed.body);
      }
      expect(
        await prisma.channelMember.count({
          where: { channelId, userId: guest.id },
        }),
      ).toBe(0);
      await request(app.getHttpServer())
        .get(`/channels/${channelId}/messages`)
        .auth(guest.token, { type: 'bearer' })
        .expect(403);
    },
  );
});
