import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

type User = { id: string; email: string; token: string };

describe('Sessions and channel invitations (PostgreSQL E2E)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let prisma: PrismaService;
  let owner: User;
  let guest: User;
  const password = 'Session-invitation-test-password!';
  const name = () => `e2e-${randomBytes(8).toString('hex')}`;
  const signup = async (): Promise<User> => {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: `${name()}@example.test`, password })
      .expect(201);
    return response.body;
  };
  const createChannel = async (isPrivate = true): Promise<{ id: string }> => {
    const response = await request(app.getHttpServer())
      .post('/channels')
      .auth(owner.token, { type: 'bearer' })
      .send({ name: name(), isPrivate })
      .expect(201);
    return response.body;
  };
  const invite = (channelId: string) =>
    request(app.getHttpServer())
      .post(`/channels/${channelId}/invitations`)
      .auth(owner.token, { type: 'bearer' })
      .send({ userId: guest.id });
  const accept = (id: string, token = guest.token) =>
    request(app.getHttpServer())
      .post(`/channel-invitations/${id}/accept`)
      .auth(token, { type: 'bearer' });

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
    if (app) await app.close();
    else await module?.close();
  });

  it('reports application liveness and real database readiness', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });

  it('persists logout across application instances while keeping another login valid', async () => {
    const user = await signup();
    const secondLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    const anotherModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const anotherApp = anotherModule.createNestApplication();
    try {
      configureApp(anotherApp, { authRateLimit: { limit: 1000 } });
      await anotherApp.init();
      await request(anotherApp.getHttpServer())
        .get('/auth/me')
        .auth(user.token, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/logout')
        .auth(user.token, { type: 'bearer' })
        .expect(200)
        .expect({});
      for (const path of ['/auth/me', '/channels']) {
        await request(anotherApp.getHttpServer())
          .get(path)
          .auth(user.token, { type: 'bearer' })
          .expect(401);
      }
      await request(anotherApp.getHttpServer())
        .get('/auth/me')
        .auth(secondLogin.body.token, { type: 'bearer' })
        .expect(200);
      expect(
        await prisma.authSession.count({ where: { userId: user.id } }),
      ).toBe(1);
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
      await request(app.getHttpServer())
        .post('/auth/logout')
        .auth(user.token, { type: 'bearer' })
        .expect(401);
    } finally {
      await anotherApp.close();
    }
  });

  it('rejects a session expired in the database and a legacy token without a session ID', async () => {
    const user = await signup();
    const jwt = module.get(JwtService);
    const payload = jwt.verify<{ jti: string }>(user.token);
    await prisma.authSession.update({
      where: { id: payload.jti },
      data: { expiresAt: new Date(0) },
    });
    await request(app.getHttpServer())
      .get('/channels')
      .auth(user.token, { type: 'bearer' })
      .expect(401);
    const legacyToken = jwt.sign({ sub: owner.id });
    await request(app.getHttpServer())
      .get('/channels')
      .auth(legacyToken, { type: 'bearer' })
      .expect(401);
  });

  it('removes sessions when a user is deleted', async () => {
    const user = await signup();
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(
      0,
    );
    await request(app.getHttpServer())
      .get('/channels')
      .auth(user.token, { type: 'bearer' })
      .expect(401);
  });

  it('allows only the private-channel creator to invite a registered nonmember', async () => {
    const channel = await createChannel();
    const path = `/channels/${channel.id}/invitations`;
    await request(app.getHttpServer())
      .post(path)
      .send({ userId: guest.id })
      .expect(401);
    await request(app.getHttpServer())
      .post(path)
      .auth(guest.token, { type: 'bearer' })
      .send({ userId: owner.id })
      .expect(403);
    await request(app.getHttpServer())
      .post(path)
      .auth(owner.token, { type: 'bearer' })
      .send({ userId: 'missing' })
      .expect(404);
    await request(app.getHttpServer())
      .post(path)
      .auth(owner.token, { type: 'bearer' })
      .send({ userId: owner.id })
      .expect(409);
    await request(app.getHttpServer())
      .post(path)
      .auth(owner.token, { type: 'bearer' })
      .send({ userId: guest.id, invitedById: guest.id })
      .expect(400);
    const publicChannel = await createChannel(false);
    await invite(publicChannel.id).expect(400);
    expect(
      await prisma.channelInvitation.count({
        where: { channelId: channel.id },
      }),
    ).toBe(0);
  });

  it('requires recipient acceptance before granting private-channel message access', async () => {
    const channel = await createChannel();
    const invitation = await invite(channel.id).expect(201);
    expect(invitation.body).toMatchObject({
      channelId: channel.id,
      inviteeId: guest.id,
      invitedById: owner.id,
      acceptedAt: null,
    });
    const pending = await request(app.getHttpServer())
      .get('/channel-invitations')
      .auth(guest.token, { type: 'bearer' })
      .expect(200);
    expect(pending.body).toContainEqual(
      expect.objectContaining({ id: invitation.body.id }),
    );
    const ownerPending = await request(app.getHttpServer())
      .get('/channel-invitations')
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(ownerPending.body).not.toContainEqual(
      expect.objectContaining({ id: invitation.body.id }),
    );
    await accept(invitation.body.id, owner.token).expect(404);
    await request(app.getHttpServer())
      .get(`/channels/${channel.id}/messages`)
      .auth(guest.token, { type: 'bearer' })
      .expect(403);
    await accept(invitation.body.id).expect(201);
    await accept(invitation.body.id).expect(409);
    await invite(channel.id).expect(409);
    const detail = await request(app.getHttpServer())
      .get(`/channels/${channel.id}`)
      .auth(guest.token, { type: 'bearer' })
      .expect(200);
    expect(detail.body.memberCount).toBe(2);
    expect(detail.body).not.toHaveProperty('_count');
    const sent = await request(app.getHttpServer())
      .post(`/channels/${channel.id}/messages`)
      .auth(owner.token, { type: 'bearer' })
      .send({ content: 'Private welcome' })
      .expect(201);
    const read = await request(app.getHttpServer())
      .get(`/channels/${channel.id}/messages`)
      .auth(guest.token, { type: 'bearer' })
      .expect(200);
    expect(read.body.messages).toContainEqual(sent.body);
  });

  it('handles concurrent duplicate invitations and concurrent acceptance', async () => {
    const channel = await createChannel();
    const invitations = await Promise.all([
      invite(channel.id),
      invite(channel.id),
    ]);
    expect(invitations.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const invitation = invitations.find((response) => response.status === 201)!;
    const accepted = await Promise.all([
      accept(invitation.body.id),
      accept(invitation.body.id),
    ]);
    expect(accepted.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await prisma.channelMember.count({
        where: { channelId: channel.id, userId: guest.id },
      }),
    ).toBe(1);
  });

  it('expires invitations and lets the creator renew them', async () => {
    const channel = await createChannel();
    const invitation = await invite(channel.id).expect(201);
    await prisma.channelInvitation.update({
      where: { id: invitation.body.id },
      data: { expiresAt: new Date(0) },
    });
    await accept(invitation.body.id).expect(410);
    const pending = await request(app.getHttpServer())
      .get('/channel-invitations')
      .auth(guest.token, { type: 'bearer' })
      .expect(200);
    expect(pending.body).not.toContainEqual(
      expect.objectContaining({ id: invitation.body.id }),
    );
    const renewed = await invite(channel.id).expect(201);
    expect(new Date(renewed.body.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
    await accept(renewed.body.id).expect(201);
  });

  it('lets only the creator revoke pending invitations for that channel', async () => {
    const channel = await createChannel();
    const anotherChannel = await createChannel();
    const invitation = await invite(channel.id).expect(201);
    await request(app.getHttpServer())
      .delete(`/channels/${channel.id}/invitations/${invitation.body.id}`)
      .auth(guest.token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(
        `/channels/${anotherChannel.id}/invitations/${invitation.body.id}`,
      )
      .auth(owner.token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/channels/${channel.id}/invitations/${invitation.body.id}`)
      .auth(owner.token, { type: 'bearer' })
      .expect(204);
    await accept(invitation.body.id).expect(404);
    expect(
      await prisma.channelMember.count({
        where: { channelId: channel.id, userId: guest.id },
      }),
    ).toBe(0);
  });

  it('serializes acceptance and revocation without a server error or duplicate membership', async () => {
    const channel = await createChannel();
    const invitation = await invite(channel.id).expect(201);
    const [accepted, revoked] = await Promise.all([
      accept(invitation.body.id),
      request(app.getHttpServer())
        .delete(`/channels/${channel.id}/invitations/${invitation.body.id}`)
        .auth(owner.token, { type: 'bearer' }),
    ]);
    expect([201, 404, 409]).toContain(accepted.status);
    expect([204, 404]).toContain(revoked.status);
    const membershipCount = await prisma.channelMember.count({
      where: { channelId: channel.id, userId: guest.id },
    });
    expect(membershipCount).toBe(accepted.status === 201 ? 1 : 0);
    expect(revoked.status).toBe(accepted.status === 201 ? 404 : 204);
  });
});
