import { NestFactory }     from '@nestjs/core';
import { ValidationPipe }  from '@nestjs/common';
import { ConfigService }   from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet              from 'helmet';
import * as compression    from 'compression';
import { AppModule }       from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor }  from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log','warn','error'] });
  const cfg     = app.get(ConfigService);
  const port    = cfg.get<number>('app.port', 3000);
  const env     = cfg.get<string>('app.nodeEnv', 'development');
  const origins = cfg.get<string>('app.corsOrigins','').split(',').map(s => s.trim());

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.enableCors({ origin: env === 'production' ? origins : true, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Tenant-ID'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  if (env !== 'production') {
    const doc = new DocumentBuilder().setTitle('EstimateOS API').setDescription('AI-powered enterprise estimation platform').setVersion('1.0').addBearerAuth({ type:'http', scheme:'bearer', bearerFormat:'JWT' },'JWT').build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), { swaggerOptions: { persistAuthorization: true } });
    console.log(`📖 Swagger: http://localhost:${port}/api/docs`);
  }
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 EstimateOS API running on port ${port} [${env}]`);
}
bootstrap();
