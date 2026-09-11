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

export class ChannelMemberResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() channelId: string;
  @ApiProperty() userId: string;
  @ApiProperty() joinedAt: Date;
}