import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { validateEnvironment } from './config/environment.js';
import { HealthController } from './health/health.controller.js';
// import { UsersModule } from './users/users.module'; // Item 1 - auth teammate's module

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: ['test', 'production'].includes(
        process.env.NODE_ENV ?? '',
      ),
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    ChannelsModule,
    MessagesModule,
    // UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
