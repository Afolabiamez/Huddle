import { INestApplication, ValidationPipe } from '@nestjs/common';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export interface ConfigureAppOptions {
  authRateLimit?: {
    limit?: number;
    windowMs?: number;
  };
  production?: boolean;
}

export function configureApp(
  app: INestApplication,
  options: ConfigureAppOptions = {},
): void {
  const production =
    options.production ?? process.env.NODE_ENV === 'production';

  const corsOptions: CorsOptions = {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };
  app.enableCors(corsOptions);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Keep development Swagger usable over localhost HTTP.
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      strictTransportSecurity: production,
    }),
  );

  // Login and signup share an IP budget. Never trust forwarded IP headers
  // unless the deployment explicitly configures its trusted reverse proxy.
  app.use(
    ['/auth/login', '/auth/signup'],
    rateLimit({
      windowMs: options.authRateLimit?.windowMs ?? 60_000,
      limit: options.authRateLimit?.limit ?? 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => req.method !== 'POST',
      message: {
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too many authentication attempts. Please try again later.',
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
