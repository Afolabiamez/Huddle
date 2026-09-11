import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { MessagesModule } from './messages/messages.module.js';
// import { UsersModule } from './users/users.module'; // Item 1 - auth teammate's module

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ChannelsModule,
    MessagesModule,
    // UsersModule,
  ],
})
export class AppModule {}