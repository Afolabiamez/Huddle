import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ example: 'general', description: 'Unique channel name' })
  @IsString()
  @Length(2, 40)
  @Matches(/^[a-z0-9-_]+$/, {
    message: 'name may only contain lowercase letters, numbers, hyphens and underscores',
  })
  name: string;

  @ApiPropertyOptional({ example: 'General team discussion' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}