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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard.js';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/signup → 201 { id, email, token }
  @Post('signup')
  async signup(@Body(new ValidationPipe({ whitelist: true })) dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // POST /auth/login → 200 { id, email, token }
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ValidationPipe({ whitelist: true })) dto: LoginDto) {
    return this.authService.login(dto);
  }

  // POST /auth/logout → 200 {}
  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current login session' })
  async logout(@Req() req: AuthenticatedRequest) {
    await this.authService.logout(req.user);
    return {};
  }

  // GET /auth/me → 200 { id, email }  (requires Bearer token)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.authService.findById(req.user.id);
    if (!user) throw new UnauthorizedException('User no longer exists.');
    return user;
  }
}
