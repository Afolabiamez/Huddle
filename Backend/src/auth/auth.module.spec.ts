import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthModule } from './auth.module.js';

describe('JWT configuration', () => {
  it('signs and verifies with the secret supplied by ConfigService after imports', async () => {
    const secret = 'injected-jwt-configuration-test-secret';
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [() => ({ JWT_SECRET: secret })],
        }),
        PrismaModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    try {
      const jwt = module.get(JwtService);
      const token = jwt.sign({ sub: 'test-user' });
      expect(new JwtService({ secret }).verify(token).sub).toBe('test-user');
      expect(jwt.verify(token).sub).toBe('test-user');
    } finally {
      await module.close();
    }
  });
});
