import { ValidationPipe } from '@nestjs/common';
import { LoginDto } from './login.dto.js';
import { SignupDto } from './signup.dto.js';

describe.each([
  ['signup', SignupDto],
  ['login', LoginDto],
] as const)('%s password validation', (_name, metatype) => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (password: string) =>
    pipe.transform(
      { email: 'password@example.test', password },
      { type: 'body', metatype },
    );

  it.each(['a'.repeat(72), '😀'.repeat(18)])(
    'accepts a password at the 72-byte boundary %#',
    async (password) => {
      await expect(validate(password)).resolves.toMatchObject({ password });
    },
  );

  it.each(['a'.repeat(73), '😀'.repeat(19), 'a'.repeat(71) + 'é'])(
    'rejects a password exceeding 72 UTF-8 bytes %#',
    async (password) => {
      await expect(validate(password)).rejects.toMatchObject({ status: 400 });
    },
  );
});
