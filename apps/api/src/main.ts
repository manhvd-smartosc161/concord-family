import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown props
      forbidNonWhitelisted: true, // 400 if extra props sent
      transform: true,
    }),
  );
  const port = parseInt(process.env.API_PORT ?? '3001', 10);
  await app.listen(port);
  Logger.log(
    `🟢 Concord API listening on http://localhost:${port}`,
    'Bootstrap',
  );
}
void bootstrap();
