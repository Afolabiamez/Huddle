import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { LoginDto } from './dto/login.dto.js';

const SALT_ROUNDS = 12;
const GENERIC_AUTH_ERROR = 'Invalid email or password.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<{ id: string; email: string; token: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('This email address is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });

    const token = this.issueToken(user.id);
    return { id: user.id, email: user.email, token };
  }

  async login(dto: LoginDto): Promise<{ id: string; email: string; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Critical: same error whether email not found OR password wrong
    // This prevents revealing which part was incorrect.
    const passwordMatches =
      user && (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const token = this.issueToken(user.id);
    return { id: user.id, email: user.email, token };
  }

  async findById(id: string): Promise<{ id: string; email: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  private issueToken(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }
}
