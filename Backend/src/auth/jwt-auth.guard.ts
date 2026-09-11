// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { Request } from 'express';

// export interface AuthenticatedRequest extends Request {
//   user: { id: string; email?: string };
// }

// /**
//  * Verifies the Bearer token issued by Item 1 (sign-up/sign-in) and attaches
//  * `{ id, email }` to `request.user`. Swap the payload shape below if the
//  * auth teammate signs the JWT with different claim names (e.g. `userId`
//  * instead of `sub`).
//  */
// @Injectable()
// export class JwtAuthGuard implements CanActivate {
//   constructor(private readonly jwtService: JwtService) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
//     const token = this.extractTokenFromHeader(request);

//     if (!token) {
//       throw new UnauthorizedException('Missing bearer token');
//     }

//     try {
//       const payload = await this.jwtService.verifyAsync<{ sub: string; email?: string }>(
//         token,
//       );
//       request.user = { id: payload.sub, email: payload.email };
//       return true;
//     } catch {
//       throw new UnauthorizedException('Invalid or expired token');
//     }
//   }

//   private extractTokenFromHeader(request: Request): string | undefined {
//     const [type, token] = request.headers.authorization?.split(' ') ?? [];
//     return type === 'Bearer' ? token : undefined;
//   }
// }

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    request.user = {
      id: 'test-user-1',
    };

    return true;
  }
}