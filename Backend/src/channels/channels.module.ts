import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';
import { ChannelInvitationsController } from './channel-invitations.controller.js';
import { ChannelInvitationsService } from './channel-invitations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ChannelsController, ChannelInvitationsController],
  providers: [ChannelsService, ChannelInvitationsService],
  // Exported so MessagesService can call assertMembership() without
  // duplicating channel-access logic.
  exports: [ChannelsService],
})
export class ChannelsModule {}
