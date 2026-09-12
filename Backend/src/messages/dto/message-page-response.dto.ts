import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto.js';

export class MessagePageResponseDto {
  @ApiProperty({ type: [MessageResponseDto] }) messages: MessageResponseDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor: string | null;
}
