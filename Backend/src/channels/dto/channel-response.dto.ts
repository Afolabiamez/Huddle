import { ApiProperty } from '@nestjs/swagger';

export class ChannelResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() isPrivate: boolean;
  @ApiProperty() createdById: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() memberCount?: number;
}

export class ChannelListItemResponseDto extends ChannelResponseDto {
  @ApiProperty({
    type: Boolean,
    description: 'Whether the authenticated user has joined this channel',
  })
  isMember: boolean;
}

export class ChannelMemberResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() channelId: string;
  @ApiProperty() userId: string;
  @ApiProperty() joinedAt: Date;
}
