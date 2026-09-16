import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './jwt.strategy.js';

interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

describe('Persistent authentication sessions (HTTP)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let auth: AuthService;
  let passwordHash: string;
  const sessions = new Map<string, Session>();
  const credentials = {
    email: 'sessions@example.test',
    password: 'Session-test-password',
  };
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    authSession: {
      create: vi.fn(({ data }: { data: Session }) => {
        sessions.set(data.id, data);
        return data;
      }),
      findUnique: vi.fn(
        ({ where }: { where: { id: string } }) =>
          sessions.get(where.id) ?? null,
      ),
      deleteMany: vi.fn(
        ({ where }: { where: { id: string; userId: string } }) => {
          const session = sessions.get(where.id);
          const deleted = session?.userId === where.userId;
          if (deleted) sessions.delete(where.id);
          return { count: deleted ? 1 : 0 };
        },
      ),
    },
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(credentials.password, 4);
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'authentication-session-test-secret' }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtAuthGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    jwt = module.get(JwtService);
    auth = module.get(AuthService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessions.clear();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user',
      email: credentials.email,
      passwordHash,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const login = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    return response.body.token as string;
  };

  const readProfile = (token: string) =>
    request(app.getHttpServer())
      .get('/auth/me')
      .auth(token, { type: 'bearer' });

  it('revokes the current persisted session and keeps another login active', async () => {
    const firstToken = await login();
    const secondToken = await login();
    const first = jwt.verify<{ sub: string; jti: string; exp: number }>(
      firstToken,
    );
    const second = jwt.verify<{ sub: string; jti: string; exp: number }>(
      secondToken,
    );
    expect(first.jti).not.toBe(second.jti);
    expect(sessions.get(first.jti)?.expiresAt.getTime()).toBe(first.exp * 1000);
    await readProfile(firstToken).expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .auth(firstToken, { type: 'bearer' })
      .expect(200, {});
    expect(sessions.has(first.jti)).toBe(false);
    expect(sessions.has(second.jti)).toBe(true);
    await readProfile(firstToken).expect(401);
    await readProfile(secondToken).expect(200);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .auth(firstToken, { type: 'bearer' })
      .expect(401);
  });

  it('requires authentication to log out', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(401);
    expect(prisma.authSession.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ['missing subject', { jti: 'session', exp: 4102444800 }],
    ['empty subject', { sub: '', jti: 'session', exp: 4102444800 }],
    ['non-string subject', { sub: 123, jti: 'session', exp: 4102444800 }],
    ['legacy token without session', { sub: 'user', exp: 4102444800 }],
    ['empty session', { sub: 'user', jti: '', exp: 4102444800 }],
    ['missing expiration', { sub: 'user', jti: 'session' }],
    [
      'fractional expiration',
      { sub: 'user', jti: 'session', exp: 4102444800.5 },
    ],
    ['expired token', { sub: 'user', jti: 'session', exp: 1 }],
  ])('rejects a signed token with %s', async (_description, payload) => {
    const token = jwt.sign(payload);
    await readProfile(token).expect(401);
    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token whose session belongs to a different user', async () => {
    const token = await login();
    const payload = jwt.verify<{ jti: string }>(token);
    sessions.get(payload.jti)!.userId = 'another-user';
    await readProfile(token).expect(401);
  });

  it.each(['expired', 'different expiration'])(
    'rejects a session with %s',
    async (state) => {
      const token = await login();
      const payload = jwt.verify<{ jti: string; exp: number }>(token);
      sessions.get(payload.jti)!.expiresAt = new Date(
        state === 'expired' ? 1000 : (payload.exp + 1) * 1000,
      );
      await readProfile(token).expect(401);
    },
  );

  it('preserves session database failures as server errors', async () => {
    const token = await login();
    prisma.authSession.findUnique.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );
    await readProfile(token).expect(500);
  });

  it('rejects signatures made with a different key or algorithm', async () => {
    const token = await login();
    const payload = jwt.verify(token);
    const differentKey = new JwtService({ secret: 'another-test-secret' }).sign(
      payload,
    );
    const differentAlgorithm = jwt.sign(payload, { algorithm: 'HS384' });
    await readProfile(differentKey).expect(401);
    await readProfile(differentAlgorithm).expect(401);
  });

  it('uses the same persisted-session validation in the Passport strategy', async () => {
    const strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'authentication-session-test-secret' }),
      auth,
    );
    const token = await login();
    const payload = jwt.verify<{ sub: string; jti: string }>(token);
    await expect(strategy.validate(payload)).resolves.toEqual({
      id: payload.sub,
      sessionId: payload.jti,
    });
    sessions.delete(payload.jti);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
