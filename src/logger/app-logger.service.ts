import { Injectable, LoggerService, Scope } from '@nestjs/common';
import pino, { Logger } from 'pino';

@Injectable({ scope: Scope.DEFAULT })
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    const isDev = process.env.NODE_ENV === 'development';
    const logLevel = process.env.LOG_LEVEL || 'info';

    this.logger = pino({
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
      transport:
        isDev && process.env.PRETTY_LOGS === 'true'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    });
  }

  log(message: string, context?: Record<string, unknown> | string): void {
    if (typeof context === 'object' && context !== null) {
      this.logger.info(context, message);
    } else {
      this.logger.info({ context }, message);
    }
  }

  error(
    message: string,
    trace?: string,
    context?: Record<string, unknown> | string,
  ): void {
    const meta =
      typeof context === 'object' && context !== null ? context : { context };
    this.logger.error({ ...meta, trace }, message);
  }

  warn(message: string, context?: Record<string, unknown> | string): void {
    if (typeof context === 'object' && context !== null) {
      this.logger.warn(context, message);
    } else {
      this.logger.warn({ context }, message);
    }
  }

  debug(message: string, context?: Record<string, unknown> | string): void {
    if (typeof context === 'object' && context !== null) {
      this.logger.debug(context, message);
    } else {
      this.logger.debug({ context }, message);
    }
  }

  verbose(message: string, context?: Record<string, unknown> | string): void {
    if (typeof context === 'object' && context !== null) {
      this.logger.trace(context, message);
    } else {
      this.logger.trace({ context }, message);
    }
  }

  logApiFailure(
    endpoint: string,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    this.logger.error(
      {
        event: 'API_REQUEST_FAILURE',
        endpoint,
        error: errorMessage,
        stack: errorStack,
        ...metadata,
      },
      `API request failed for endpoint: ${endpoint}`,
    );
  }

  logTransformationError(
    operation: string,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(
      {
        event: 'TRANSFORMATION_ERROR',
        operation,
        error: errorMessage,
        ...metadata,
      },
      `Data transformation error during ${operation}: ${errorMessage}`,
    );
  }

  logLifecycleEvent(
    event: 'startup' | 'shutdown' | 'ready',
    metadata?: Record<string, unknown>,
  ): void {
    this.logger.info(
      {
        event: `APPLICATION_${event.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      `Application event: ${event}`,
    );
  }
}
