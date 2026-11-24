import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { AppLogger } from './logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  app.enableShutdownHooks();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  logger.logLifecycleEvent('startup', {
    port,
    nodeEnv: process.env.NODE_ENV || 'development',
  });

  process.on('SIGTERM', () => {
    logger.logLifecycleEvent('shutdown', { signal: 'SIGTERM' });
  });

  process.on('SIGINT', () => {
    logger.logLifecycleEvent('shutdown', { signal: 'SIGINT' });
  });

  await app.listen(port);
  logger.log(`Server is running at http://localhost:${port}/graphql`);
}

void bootstrap();
