import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('Signup uniqueness', () => {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    authSession: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const jwt = { sign: vi.fn() };
  const dto = {
    email: 'signup@example.test',
    password: 'Signup-test-password',
  };
  const user = { id: 'user', email: dto.email };
  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (
        operation: (transaction: Prisma.TransactionClient) => Promise<unknown>,
      ) => operation(prisma as unknown as Prisma.TransactionClient),
    );
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
    jwt.sign.mockReturnValue('test-token');
  });

  it('returns a conflict when concurrent requests both pass the email check', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValueOnce(user).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
        meta: { target: ['email'] },
      }),
    );
    const results = await Promise.allSettled([
      service.signup(dto),
      service.signup(dto),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure?.reason).toBeInstanceOf(ConflictException);
    expect(failure?.reason.getStatus()).toBe(409);
    expect(jwt.sign).toHaveBeenCalledTimes(1);
  });

  it('does not disguise unrelated database errors as duplicate email conflicts', async () => {
    const failure = new Error('Database unavailable');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(failure);
    await expect(service.signup(dto)).rejects.toBe(failure);
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('rejects an email that is already registered', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(service.signup(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('does not return a token when session persistence fails', async () => {
    const failure = new Error('Session store unavailable');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    prisma.authSession.create.mockRejectedValue(failure);
    await expect(service.signup(dto)).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});
