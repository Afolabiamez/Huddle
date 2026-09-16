import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { LoginDto } from './dto/login.dto.js';

const SALT_ROUNDS = 12;
const GENERIC_AUTH_ERROR = 'Invalid email or password.';
const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const MAX_SESSIONS_PER_USER = 5;

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(
    dto: SignupDto,
  ): Promise<{ id: string; email: string; token: string }> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('This email address is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.prisma.$transaction(async (transaction) => {
      const user = await this.createUser(transaction, email, passwordHash);
      const token = await this.issueToken(user.id, transaction);
      return { id: user.id, email: user.email, token };
    });
  }

  private async createUser(
    transaction: Prisma.TransactionClient,
    email: string,
    passwordHash: string,
  ) {
    try {
      return await transaction.user.create({ data: { email, passwordHash } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This email address is already registered.',
        );
      }
      throw error;
    }
  }

  async login(
    dto: LoginDto,
  ): Promise<{ id: string; email: string; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Critical: same error whether email not found OR password wrong
    // This prevents revealing which part was incorrect.
    const passwordMatches =
      user && (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const token = await this.issueToken(user.id);
    return { id: user.id, email: user.email, token };
  }

  async findById(id: string): Promise<{ id: string; email: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  async validateSession(payload: unknown): Promise<AuthenticatedUser> {
    if (!payload || typeof payload !== 'object') {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    const { sub, jti, exp } = payload as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof sub !== 'string' ||
      sub.trim().length === 0 ||
      typeof jti !== 'string' ||
      jti.trim().length === 0 ||
      typeof exp !== 'number' ||
      !Number.isSafeInteger(exp) ||
      exp <= now
    ) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    // Keep database failures visible as server errors instead of turning an
    // unavailable session store into a misleading authentication failure.
    const session = await this.prisma.authSession.findUnique({
      where: { id: jti },
    });
    if (
      !session ||
      session.userId !== sub ||
      session.expiresAt.getTime() <= Date.now() ||
      session.expiresAt.getTime() !== exp * 1000
    ) {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    return { id: sub, sessionId: jti };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    // deleteMany is safe when two already-authenticated logout requests race.
    await this.prisma.authSession.deleteMany({
      where: { id: user.sessionId, userId: user.id },
    });
  }

  private async issueToken(
    userId: string,
    transaction: Pick<Prisma.TransactionClient, 'authSession'> = this.prisma,
  ): Promise<string> {
    const id = randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((issuedAt + SESSION_LIFETIME_SECONDS) * 1000);
    const token = this.jwt.sign(
      { sub: userId, jti: id, iat: issuedAt },
      { expiresIn: SESSION_LIFETIME_SECONDS, algorithm: 'HS256' },
    );
    await transaction.authSession.create({
      data: { id, userId, expiresAt },
    });
    // Evict oldest sessions if the user exceeds the cap.
    const sessions = await this.prisma.authSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (sessions.length > MAX_SESSIONS_PER_USER) {
      const toDelete = sessions
        .slice(0, sessions.length - MAX_SESSIONS_PER_USER)
        .map((s) => s.id);
      await this.prisma.authSession.deleteMany({ where: { id: { in: toDelete } } });
    }
    return token;
  }
}
