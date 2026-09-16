import { IsEmail, IsString } from 'class-validator';
import { MaxUtf8Bytes } from '../validators/max-utf8-bytes.decorator.js';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email: string;

  @IsString()
  @MaxUtf8Bytes(72)
  password: string;
}
