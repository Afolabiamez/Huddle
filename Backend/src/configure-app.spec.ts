import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from './configure-app.js';

@Controller('auth')
class AuthenticationStubController {
  @Post('login')
  login() {
    return {};
  }

  @Post('signup')
  signup() {
    return {};
  }

  @Get('me')
  me() {
    return {};
  }
}

describe('Production HTTP safeguards', () => {
  let app: INestApplication;
  const windowMs = 1000;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthenticationStubController],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, {
      authRateLimit: { limit: 2, windowMs },
      production: true,
    });
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('sets security headers and removes the Express signature', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('shares the signup/login budget, returns 429, and allows requests after reset', async () => {
    await request(app.getHttpServer()).post('/auth/login').expect(201);
    await request(app.getHttpServer()).post('/auth/signup').expect(201);
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .expect(429);
    expect(response.headers['retry-after']).toBeDefined();
    expect(response.headers.ratelimit).toBeDefined();
    expect(response.body).toMatchObject({ statusCode: 429 });

    // Other authenticated API routes must remain usable after this budget ends.
    await request(app.getHttpServer()).get('/auth/me').expect(200);
    await new Promise((resolve) => setTimeout(resolve, windowMs + 50));
    await request(app.getHttpServer()).post('/auth/login').expect(201);
  });

  it('does not charge preflight requests against authentication attempts', async () => {
    await request(app.getHttpServer()).options('/auth/login');
    await request(app.getHttpServer()).options('/auth/signup');
    await request(app.getHttpServer()).post('/auth/login').expect(201);
    await request(app.getHttpServer()).post('/auth/signup').expect(201);
  });
});
