import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ChannelInvitationsService } from './channel-invitations.service.js';
import {
  ChannelInvitationResponseDto,
  PendingChannelInvitationDto,
} from './dto/channel-invitation-response.dto.js';
import { ChannelMemberResponseDto } from './dto/channel-response.dto.js';
import { InviteUserDto } from './dto/invite-user.dto.js';

@ApiTags('Channel invitations')
@ApiBearerAuth()
@ApiResponse({
  status: 401,
  description: 'Missing or invalid access token, or inactive session',
})
@UseGuards(JwtAuthGuard)
@Controller()
export class ChannelInvitationsController {
  constructor(private readonly invitations: ChannelInvitationsService) {}

  @Post('channels/:channelId/invitations')
  @ApiOperation({
    summary: 'Invite a registered user to a private channel (creator only)',
  })
  @ApiResponse({ status: 201, type: ChannelInvitationResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid invitation body or channel is public',
  })
  @ApiResponse({
    status: 403,
    description: 'Only the channel creator can invite',
  })
  @ApiResponse({ status: 404, description: 'Channel or recipient not found' })
  @ApiResponse({
    status: 409,
    description: 'Recipient is already a member or has an existing invitation',
  })
  invite(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Body() dto: InviteUserDto,
  ) {
    return this.invitations.invite(user.id, channelId, dto.userId);
  }

  @Get('channel-invitations')
  @ApiOperation({ summary: 'List your pending, unexpired invitations' })
  @ApiResponse({ status: 200, type: [PendingChannelInvitationDto] })
  list(@CurrentUser() user: { id: string }) {
    return this.invitations.listPending(user.id);
  }

  @Post('channel-invitations/:invitationId/accept')
  @ApiOperation({ summary: 'Accept an invitation addressed to you' })
  @ApiResponse({ status: 201, type: ChannelMemberResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found or addressed to another user',
  })
  @ApiResponse({
    status: 409,
    description:
      'Invitation already accepted, no longer available, or user is already a member',
  })
  @ApiResponse({ status: 410, description: 'Invitation expired' })
  accept(
    @CurrentUser() user: { id: string },
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitations.accept(user.id, invitationId);
  }

  @Delete('channels/:channelId/invitations/:invitationId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a pending invitation (creator only)' })
  @ApiResponse({ status: 204, description: 'Pending invitation revoked' })
  @ApiResponse({ status: 400, description: 'Channel is public' })
  @ApiResponse({
    status: 403,
    description: 'Only the channel creator can revoke invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'Channel or pending invitation not found',
  })
  revoke(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitations.revoke(user.id, channelId, invitationId);
  }
}
