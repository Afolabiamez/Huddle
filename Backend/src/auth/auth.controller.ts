import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/signup → 201 { id, email, token }
  @Post('signup')
  async signup(
    @Body(new ValidationPipe({ whitelist: true })) dto: SignupDto,
  ) {
    return this.authService.signup(dto);
  }

  // POST /auth/login → 200 { id, email, token }
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ValidationPipe({ whitelist: true })) dto: LoginDto,
  ) {
    return this.authService.login(dto);
  }

  // POST /auth/logout → 200 {}
  @Post('logout')
  @HttpCode(200)
  logout() {
    return {};
  }

  // GET /auth/me → 200 { id, email }  (requires Bearer token)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const user = await this.authService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
