import { ApiProperty } from '@nestjs/swagger';

export class ChannelInvitationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() channelId: string;
  @ApiProperty() inviteeId: string;
  @ApiProperty() invitedById: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() expiresAt: Date;
  @ApiProperty({ type: Date, nullable: true }) acceptedAt: Date | null;
}

export class InvitedChannelDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
}

export class PendingChannelInvitationDto extends ChannelInvitationResponseDto {
  @ApiProperty({ type: InvitedChannelDto }) channel: InvitedChannelDto;
}
