import { IsEmail, IsString, MinLength } from 'class-validator';
import { MaxUtf8Bytes } from '../validators/max-utf8-bytes.decorator.js';

export class SignupDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxUtf8Bytes(72)
  password: string;
}
