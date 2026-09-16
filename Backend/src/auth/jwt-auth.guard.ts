import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService, type AuthenticatedUser } from './auth.service.js';

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('No authentication token provided.');
    }
    let payload: unknown;
    try {
      payload = this.jwt.verify(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    request.user = await this.auth.validateSession(payload);
    return true;
  }

  private extractToken(request: Request): string | null {
    const match = request.headers.authorization?.match(/^Bearer ([^\s]+)$/i);
    return match?.[1] ?? null;
  }
}
