import { randomBytes } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

type User = { id: string; email: string; token: string };
type Message = { id: string; content: string; senderId: string };

describe('Huddle API (PostgreSQL E2E)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let prisma: PrismaService;
  let owner: User;
  let guest: User;
  const password = 'E2e-only-password-123!';
  const uniqueName = () => `e2e-${randomBytes(8).toString('hex')}`;

  const signup = async (): Promise<User> => {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: `${uniqueName()}@example.test`, password })
      .expect(201);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body.token).toEqual(expect.any(String));
    return response.body;
  };

  const createChannel = async (isPrivate = false) => {
    const response = await request(app.getHttpServer())
      .post('/channels')
      .auth(owner.token, { type: 'bearer' })
      .send({ name: uniqueName(), isPrivate })
      .expect(201);
    return response.body as { id: string; name: string; memberCount: number };
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
    if (app) await app.close();
    else await module?.close();
  });

  it('persists a hashed password and authenticates with the signup token', async () => {
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(stored.passwordHash).not.toBe(password);
    expect(stored.passwordHash).toMatch(/^\$2[ab]\$/);
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(owner.token, { type: 'bearer' })
      .expect(200)
      .expect({ id: owner.id, email: owner.email });
  });

  it('logs in and issues a usable token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password })
      .expect(200);
    expect(response.body).not.toHaveProperty('passwordHash');
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(response.body.token, { type: 'bearer' })
      .expect(200);
  });

  it('returns the same error for an unknown email and an incorrect password', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password: 'incorrect' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'absent@example.test', password })
      .expect(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('rejects a duplicate signup', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: owner.email, password })
      .expect(409);
  });

  it('returns one success and one conflict for simultaneous signup with the same email', async () => {
    const email = `${uniqueName()}@example.test`;
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password }),
      request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it.each([
    { email: 'invalid', password },
    { email: 'valid@example.test', password: 'short' },
    { email: 'valid@example.test', password, admin: true },
    { email: 'valid@example.test', password: 'a'.repeat(73) },
    { email: 'valid@example.test', password: '😀'.repeat(19) },
  ])('rejects invalid signup input %#', async (body) => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(body)
      .expect(400);
  });

  it('accepts a 72-byte Unicode password and rejects an overlong login suffix', async () => {
    const email = `${uniqueName()}@example.test`;
    const boundaryPassword = '😀'.repeat(18);
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: boundaryPassword })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: boundaryPassword })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: boundaryPassword + 'ignored-suffix' })
      .expect(400);
  });

  it.each(['/auth/me', '/channels'])(
    'requires authentication for %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .auth('invalid-token', { type: 'bearer' })
        .expect(401);
    },
  );

  it('creates a channel and automatically adds its creator', async () => {
    const channel = await createChannel();
    expect(channel.memberCount).toBe(1);
    const members = await request(app.getHttpServer())
      .get(`/channels/${channel.id}/members`)
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(members.body).toEqual([
      expect.objectContaining({ userId: owner.id, channelId: channel.id }),
    ]);
    await request(app.getHttpServer())
      .post('/channels')
      .auth(owner.token, { type: 'bearer' })
      .send({ name: channel.name })
      .expect(409);
  });

  it('supports two users joining a public channel and exchanging persisted messages', async () => {
    const channel = await createChannel();
    const path = `/channels/${channel.id}/messages`;
    await request(app.getHttpServer())
      .get(path)
      .auth(guest.token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(path)
      .auth(guest.token, { type: 'bearer' })
      .send({ content: 'Not yet a member' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/channels/${channel.id}/join`)
      .auth(guest.token, { type: 'bearer' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/channels/${channel.id}/join`)
      .auth(guest.token, { type: 'bearer' })
      .expect(409);
    const sent = await request(app.getHttpServer())
      .post(path)
      .auth(owner.token, { type: 'bearer' })
      .send({ content: 'Hello from the owner' })
      .expect(201);
    const read = await request(app.getHttpServer())
      .get(path)
      .auth(guest.token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toEqual({ messages: [sent.body], nextCursor: null });
    expect(sent.body.senderId).toBe(owner.id);
    expect(
      await prisma.message.count({
        where: { id: sent.body.id, channelId: channel.id },
      }),
    ).toBe(1);
  });

  it('hides private channels and denies nonmembers private data and join access', async () => {
    const channel = await createChannel(true);
    const guestList = await request(app.getHttpServer())
      .get('/channels')
      .auth(guest.token, { type: 'bearer' })
      .expect(200);
    expect(
      guestList.body.some((item: { id: string }) => item.id === channel.id),
    ).toBe(false);
    const ownerList = await request(app.getHttpServer())
      .get('/channels')
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(ownerList.body).toContainEqual(
      expect.objectContaining({ id: channel.id, isMember: true }),
    );
    for (const suffix of ['', '/members', '/messages']) {
      await request(app.getHttpServer())
        .get(`/channels/${channel.id}${suffix}`)
        .auth(guest.token, { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .get(`/channels/${channel.id}${suffix}`)
        .auth(owner.token, { type: 'bearer' })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/channels/${channel.id}/join`)
      .auth(guest.token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/channels/${channel.id}/messages`)
      .auth(guest.token, { type: 'bearer' })
      .send({ content: 'Forbidden' })
      .expect(403);
  });

  it('paginates CUIDs without gaps or duplicates, including equal timestamps and a full final page', async () => {
    const channel = await createChannel();
    const path = `/channels/${channel.id}/messages`;
    for (let index = 0; index < 4; index++) {
      await request(app.getHttpServer())
        .post(path)
        .auth(owner.token, { type: 'bearer' })
        .send({ content: `Message ${index}` })
        .expect(201);
    }
    // Equal timestamps exercise the id tie-breaker in the database query.
    await prisma.message.updateMany({
      where: { channelId: channel.id },
      data: { createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    const first = await request(app.getHttpServer())
      .get(path)
      .query({ limit: 2 })
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(first.body.messages).toHaveLength(2);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await request(app.getHttpServer())
      .get(path)
      .query({ limit: 2, before: first.body.nextCursor })
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(second.body.messages).toHaveLength(2);
    expect(second.body.nextCursor).toBeNull();
    const chronological = [
      ...second.body.messages,
      ...first.body.messages,
    ] as Message[];
    expect(new Set(chronological.map((message) => message.id)).size).toBe(4);
    const expected = await prisma.message.findMany({
      where: { channelId: channel.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(chronological.map((message) => message.id)).toEqual(
      expected.map((message) => message.id),
    );
    const otherChannel = await createChannel();
    await request(app.getHttpServer())
      .get(`/channels/${otherChannel.id}/messages`)
      .query({ before: first.body.nextCursor })
      .auth(owner.token, { type: 'bearer' })
      .expect(400);
  });

  it('uses production validation for channel names, message bodies and page limits', async () => {
    await request(app.getHttpServer())
      .post('/channels')
      .auth(owner.token, { type: 'bearer' })
      .send({ name: 'INVALID NAME' })
      .expect(400);
    const channel = await createChannel();
    const path = `/channels/${channel.id}/messages`;
    for (const body of [
      { content: '' },
      { content: 'valid', senderId: guest.id },
    ]) {
      await request(app.getHttpServer())
        .post(path)
        .auth(owner.token, { type: 'bearer' })
        .send(body)
        .expect(400);
    }
    for (const limit of ['0', '101', 'invalid']) {
      await request(app.getHttpServer())
        .get(path)
        .query({ limit })
        .auth(owner.token, { type: 'bearer' })
        .expect(400);
    }
  });

  it('returns 404 for an unknown channel', async () => {
    for (const suffix of ['', '/members', '/messages']) {
      await request(app.getHttpServer())
        .get(`/channels/missing${suffix}`)
        .auth(owner.token, { type: 'bearer' })
        .expect(404);
    }
  });
});
