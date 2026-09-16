import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

type User = { id: string; email: string; token: string };
type Channel = { id: string; name: string };
type Message = {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  createdAt: string;
};
type Page = { messages: Message[]; nextCursor: string | null };

describe('Sprint 1 PRD acceptance (PostgreSQL E2E)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let prisma: PrismaService;
  const uniqueName = () => `prd-${randomBytes(8).toString('hex')}`;
  const password = 'Prd-acceptance-password-123!';

  const registerAndLogin = async (): Promise<User> => {
    const email = `${uniqueName()}@example.test`;
    const registered = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    expect(login.body.id).toBe(registered.body.id);
    expect(login.body.token).not.toBe(registered.body.token);
    return login.body as User;
  };

  const createChannel = async (user: User): Promise<Channel> => {
    const created = await request(app.getHttpServer())
      .post('/channels')
      .auth(user.token, { type: 'bearer' })
      .send({ name: uniqueName() })
      .expect(201);
    expect(created.body.isPrivate).toBe(false);
    expect(created.body.memberCount).toBe(1);
    return created.body as Channel;
  };

  const joinChannel = (user: User, channelId: string) =>
    request(app.getHttpServer())
      .post(`/channels/${channelId}/join`)
      .auth(user.token, { type: 'bearer' })
      .expect(201);

  const send = async (
    user: User,
    channelId: string,
    content: string,
  ): Promise<Message> => {
    const response = await request(app.getHttpServer())
      .post(`/channels/${channelId}/messages`)
      .auth(user.token, { type: 'bearer' })
      .send({ content })
      .expect(201);
    expect(response.body).toMatchObject({
      channelId,
      senderId: user.id,
      content,
    });
    return response.body as Message;
  };

  const read = async (
    user: User,
    channelId: string,
    query: { limit?: number; before?: string } = {},
  ): Promise<Page> => {
    const response = await request(app.getHttpServer())
      .get(`/channels/${channelId}/messages`)
      .auth(user.token, { type: 'bearer' })
      .query(query)
      .expect(200);
    return response.body as Page;
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app, { authRateLimit: { limit: 1000 } });
    await app.init();
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    if (app) await app.close();
    else await module?.close();
  });

  it('completes signup, login, discovery, joining and a two-way conversation for both users', async () => {
    const owner = await registerAndLogin();
    const teammate = await registerAndLogin();
    const created = await createChannel(owner);
    const available = await request(app.getHttpServer())
      .get('/channels')
      .auth(teammate.token, { type: 'bearer' })
      .expect(200);
    const discovered = (available.body as Channel[]).find(
      (channel) => channel.name === created.name,
    );
    expect(discovered).toMatchObject({ id: created.id, isMember: false });
    const channelId = discovered!.id;
    await joinChannel(teammate, channelId);
    const joinedList = await request(app.getHttpServer())
      .get('/channels')
      .auth(teammate.token, { type: 'bearer' })
      .expect(200);
    expect(joinedList.body).toContainEqual(
      expect.objectContaining({ id: channelId, isMember: true }),
    );
    for (const participant of [owner, teammate]) {
      const detail = await request(app.getHttpServer())
        .get(`/channels/${channelId}`)
        .auth(participant.token, { type: 'bearer' })
        .expect(200);
      expect(detail.body.memberCount).toBe(2);
      expect(await read(participant, channelId)).toEqual({
        messages: [],
        nextCursor: null,
      });
    }

    const greeting = await send(owner, channelId, 'Can you see this message?');
    expect(await read(teammate, channelId)).toEqual({
      messages: [greeting],
      nextCursor: null,
    });
    const reply = await send(teammate, channelId, 'Yes, and here is my reply.');
    for (const participant of [owner, teammate]) {
      expect(await read(participant, channelId)).toEqual({
        messages: [greeting, reply],
        nextCursor: null,
      });
    }
    const stored = await prisma.message.findMany({
      where: { channelId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, senderId: true, content: true },
    });
    expect(stored).toEqual(
      [greeting, reply].map(({ id, senderId, content }) => ({
        id,
        senderId,
        content,
      })),
    );
  });

  it('lets a later joiner read all earlier messages across multiple pages', async () => {
    const owner = await registerAndLogin();
    const lateJoiner = await registerAndLogin();
    const channel = await createChannel(owner);
    const earlier: Message[] = [];
    for (let index = 0; index < 7; index++) {
      earlier.push(await send(owner, channel.id, `Earlier message ${index}`));
    }
    await request(app.getHttpServer())
      .get(`/channels/${channel.id}/messages`)
      .auth(lateJoiner.token, { type: 'bearer' })
      .expect(403);
    const membership = await joinChannel(lateJoiner, channel.id);
    for (const message of earlier) {
      expect(Date.parse(message.createdAt)).toBeLessThanOrEqual(
        Date.parse(membership.body.joinedAt),
      );
    }

    let history: Message[] = [];
    let before: string | undefined;
    const seenCursors = new Set<string>();
    const pageSizes: number[] = [];
    for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
      const page = await read(lateJoiner, channel.id, { limit: 3, before });
      pageSizes.push(page.messages.length);
      history = [...page.messages, ...history];
      if (pageIndex < 2) {
        expect(page.nextCursor).toEqual(expect.any(String));
        expect(seenCursors.has(page.nextCursor!)).toBe(false);
        seenCursors.add(page.nextCursor!);
        before = page.nextCursor!;
      } else {
        expect(page.nextCursor).toBeNull();
      }
    }
    expect(pageSizes).toEqual([3, 3, 1]);
    expect(history).toEqual(earlier);
    expect(new Set(history.map((message) => message.id)).size).toBe(7);
  });

  it('keeps five members concurrent sends and refreshes complete and isolated', async () => {
    const members = await Promise.all(
      Array.from({ length: 5 }, () => registerAndLogin()),
    );
    const channel = await createChannel(members[0]);
    await Promise.all(
      members.slice(1).map((user) => joinChannel(user, channel.id)),
    );
    const otherChannel = await createChannel(members[0]);
    const otherMessage = await send(
      members[0],
      otherChannel.id,
      'Other channel only',
    );
    const elapsedStart = performance.now();
    const expectedContent = new Set(
      members.flatMap((_, userIndex) =>
        Array.from(
          { length: 4 },
          (_, index) => `Member ${userIndex}, message ${index}`,
        ),
      ),
    );
    const sentByMember = await Promise.all(
      members.map(async (user, userIndex) => {
        const messages: Message[] = [];
        for (let index = 0; index < 4; index++) {
          messages.push(
            await send(
              user,
              channel.id,
              `Member ${userIndex}, message ${index}`,
            ),
          );
          const snapshot = await read(user, channel.id);
          expect(snapshot.messages).toContainEqual(messages[index]);
          for (const message of snapshot.messages) {
            expect(message.channelId).toBe(channel.id);
            expect(expectedContent.has(message.content)).toBe(true);
          }
        }
        return messages;
      }),
    );
    const sent = sentByMember.flat();
    const expectedIds = sent.map((message) => message.id).sort();
    expect(new Set(expectedIds).size).toBe(20);
    const finalPages = await Promise.all(
      members.map((user) => read(user, channel.id)),
    );
    for (const page of finalPages) {
      expect(page.nextCursor).toBeNull();
      expect(page.messages.map((message) => message.id).sort()).toEqual(
        expectedIds,
      );
      expect(page.messages.map((message) => message.id)).not.toContain(
        otherMessage.id,
      );
      for (const message of sent) expect(page.messages).toContainEqual(message);
    }
    expect(
      await prisma.message.count({ where: { channelId: channel.id } }),
    ).toBe(20);
    expect(await read(members[0], otherChannel.id)).toEqual({
      messages: [otherMessage],
      nextCursor: null,
    });
    console.info(
      `PRD small-group check: 5 members, 20 sends, 25 shared-channel refreshes, ${Math.round(performance.now() - elapsedStart)}ms (local sample, not a latency SLA).`,
    );
  });
});
