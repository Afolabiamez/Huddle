import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class InviteUserDto {
  @ApiProperty({ description: 'The registered user ID of the recipient' })
  @IsString()
  @Length(1, 128)
  userId: string;
}
