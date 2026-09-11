import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() channelId: string;
  @ApiProperty() senderId: string;
  @ApiProperty() content: string;
  @ApiProperty() createdAt: Date;
}