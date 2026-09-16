import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

class UserEmailQuery {
  @IsEmail({}, { message: 'Provide a valid email address.' })
  email: string;
}

@Controller('users')
@ApiTags('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  @ApiOperation({ summary: 'Find a user by exact email — used when inviting to private channels' })
  @ApiQuery({ name: 'email', required: true, example: 'alice@huddle.com' })
  async search(@Query() query: UserEmailQuery) {
    const user = await this.prisma.user.findUnique({
      where: { email: query.email.toLowerCase() },
      select: { id: true, email: true },
    });
    return user ?? null;
  }
}
