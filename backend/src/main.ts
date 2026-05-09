import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const cfg = app.get(ConfigService);
  const port = cfg.get<number>('app.port', 3000);
  const env = cfg.get<string>('app.nodeEnv', 'development');
  const origins = cfg
    .get<string>('app.corsOrigins', '')
    .split(',')
    .map((s) => s.trim());

  // ---------------- Security Middleware ----------------
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(compression());

  // ---------------- CORS FIX (IMPORTANT PART) ----------------
  app.enableCors({
    origin:
      env === 'production'
        ? origins
        : ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
      'Cache-Control',
      'Pragma',
      'Accept',
      'Origin',
    ],
  });

  // ---------------- Global API Prefix ----------------
  app.setGlobalPrefix('api/v1');

  // ---------------- Global Pipes ----------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ---------------- Global Filters & Interceptors ----------------
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ---------------- Swagger (Dev Only) ----------------
  if (env !== 'production') {
    const docConfig = new DocumentBuilder()
      .setTitle('EstimateOS API')
      .setDescription('AI-powered enterprise estimation platform')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'JWT',
      )
      .build();

    const document = SwaggerModule.createDocument(app, docConfig);

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    console.log(`📖 Swagger: http://localhost:${port}/api/docs`);
  }

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 EstimateOS API running on port ${port} [${env}]`);
}

bootstrap();