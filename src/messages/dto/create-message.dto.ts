import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Hey team, standup in 5!' })
  @IsString()
  @Length(1, 4000)
  content: string;
}