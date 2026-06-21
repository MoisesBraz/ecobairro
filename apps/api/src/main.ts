import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/errors';
import { readNumberEnv } from '@ecobairro/config';

async function bootstrap() {
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: corsOrigin,
      credentials: true, // Allow cookies
    },
  });

  // Security: Trust proxy (Nginx) to get the real client IP
  app.set('trust proxy', 1);

  // Security: Helmet for HTTP headers
  app.use(helmet());

  // Cookies
  app.use(cookieParser());

  app.setGlobalPrefix('v1', {
    exclude: ['health', 'ready'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Normaliza todas as respostas de erro para o contrato ApiErrorResponse
  // (código máquina-legível + mensagem PT amigável; sem stack/texto interno).
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = readNumberEnv('PORT', 3000);

  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start API service', error);
  process.exit(1);
});

