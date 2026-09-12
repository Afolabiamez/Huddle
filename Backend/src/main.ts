import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  try {
    const config = app.get(ConfigService);
    const production = config.getOrThrow<string>('NODE_ENV') === 'production';
    const port = config.getOrThrow<number>('PORT');

    configureApp(app, { production });
    app.enableShutdownHooks();

    if (!production) {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('Huddle API - Channels & Messaging')
        .setDescription('Authentication, channel invitations, and messaging')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api-docs', app, document);
    }

    await app.listen(port);
    Logger.log(`Huddle API running on port ${port}`, 'Bootstrap');
    if (!production) {
      Logger.log(
        `Swagger docs at http://localhost:${port}/api-docs`,
        'Bootstrap',
      );
    }
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.message : 'Application startup failed.',
    undefined,
    'Bootstrap',
  );
  process.exitCode = 1;
});
