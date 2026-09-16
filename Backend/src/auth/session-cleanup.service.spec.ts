import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthModule } from './auth.module.js';
import { SessionCleanupService } from './session-cleanup.service.js';

const HOUR_MS = 60 * 60 * 1000;
const START_TIME = new Date('2026-09-12T12:00:00.000Z');

function deferred() {
  let resolve!: (result: { count: number }) => void;
  const promise = new Promise<{ count: number }>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('Expired authentication session cleanup', () => {
  const prisma = {
    authSession: {
      deleteMany:
        vi.fn<
          (query: {
            where: { expiresAt: { lte: Date } };
          }) => Promise<{ count: number }>
        >(),
    },
  };
  let service: SessionCleanupService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
    vi.resetAllMocks();
    prisma.authSession.deleteMany.mockResolvedValue({ count: 0 });
    service = new SessionCleanupService(prisma as unknown as PrismaService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sweeps at startup and preserves sessions whose expiration is still in the future', async () => {
    let sessions = [
      { id: 'expired', expiresAt: new Date(START_TIME.getTime() - 1) },
      { id: 'at-cutoff', expiresAt: START_TIME },
      { id: 'active', expiresAt: new Date(START_TIME.getTime() + 1) },
    ];
    prisma.authSession.deleteMany.mockImplementation(async ({ where }) => {
      const previousCount = sessions.length;
      sessions = sessions.filter(
        (session) => session.expiresAt > where.expiresAt.lte,
      );
      return { count: previousCount - sessions.length };
    });
    const interval = vi.spyOn(globalThis, 'setInterval');
    await service.onModuleInit();
    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: START_TIME } },
    });
    expect(sessions.map((session) => session.id)).toEqual(['active']);
    expect(interval).toHaveBeenCalledWith(expect.any(Function), HOUR_MS);
    expect(interval.mock.results[0].value.hasRef()).toBe(false);
  });

  it('repeats once an hour with a fresh expiration cutoff', async () => {
    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(HOUR_MS - 1);
    expect(prisma.authSession.deleteMany).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(prisma.authSession.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.authSession.deleteMany).toHaveBeenLastCalledWith({
      where: { expiresAt: { lte: new Date(START_TIME.getTime() + HOUR_MS) } },
    });
  });

  it('does not overlap sweeps when a database operation lasts more than an hour', async () => {
    const pending = deferred();
    await service.onModuleInit();
    prisma.authSession.deleteMany.mockReturnValueOnce(pending.promise);
    await vi.advanceTimersByTimeAsync(2 * HOUR_MS);
    const callsWhilePending = prisma.authSession.deleteMany.mock.calls.length;
    pending.resolve({ count: 1 });
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    expect(callsWhilePending).toBe(2);
    expect(prisma.authSession.deleteMany).toHaveBeenCalledTimes(3);
  });

  it('cancels the timer on shutdown and does not restart maintenance', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();
    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(3 * HOUR_MS);
    expect(prisma.authSession.deleteMany).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('logs a sanitized failure and retries after a transient database error', async () => {
    const warning = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    prisma.authSession.deleteMany.mockRejectedValueOnce(
      new Error('Database failure containing secret connection details'),
    );
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledExactlyOnceWith(
      'Expired session cleanup failed. It will retry on the next hourly sweep.',
    );
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    expect(prisma.authSession.deleteMany).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('finishes in-flight cleanup before Nest disconnects the global Prisma provider', async () => {
    const events: string[] = [];
    const pending = deferred();
    const lifecyclePrisma = {
      ...prisma,
      onModuleInit: vi.fn(() => {
        events.push('connect');
      }),
      onModuleDestroy: vi.fn(() => {
        events.push('disconnect');
      }),
    };
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [() => ({ JWT_SECRET: 'cleanup-lifecycle-test-secret' })],
        }),
        PrismaModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(lifecyclePrisma)
      .compile();
    try {
      prisma.authSession.deleteMany.mockImplementationOnce(async () => {
        events.push('startup-cleanup');
        return { count: 0 };
      });
      await module.init();
      prisma.authSession.deleteMany.mockImplementationOnce(async () => {
        await pending.promise;
        events.push('cleanup-finished');
        return { count: 1 };
      });
      await vi.advanceTimersByTimeAsync(HOUR_MS);
      const closing = module.close();
      await vi.advanceTimersByTimeAsync(0);
      const disconnectedBeforeSweepFinished =
        lifecyclePrisma.onModuleDestroy.mock.calls.length;
      pending.resolve({ count: 1 });
      await closing;
      expect(disconnectedBeforeSweepFinished).toBe(0);
      expect(events).toEqual([
        'connect',
        'startup-cleanup',
        'cleanup-finished',
        'disconnect',
      ]);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      pending.resolve({ count: 0 });
      await module.close();
    }
  });
});
