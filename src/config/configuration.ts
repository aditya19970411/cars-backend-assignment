import { EnvConfig } from './env.validation';

export interface AppConfig {
  env: string;
  port: number;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    ssl: boolean;
    url?: string;
  };
  logging: {
    level: string;
  };
  nhtsa: {
    baseUrl: string;
    timeoutMs: number;
    maxRetries: number;
  };
  ingestion: {
    concurrency: number;
    defaultLimit: number;
    syncOnStartup: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  observe: {
    appKey?: string;
    appSecret?: string;
  };
}

export const configuration = (): AppConfig => {
  const env = process.env as unknown as EnvConfig;
  return {
    env: env.NODE_ENV || 'development',
    port: Number(env.PORT) || 3000,
    database: {
      host: env.DATABASE_HOST || 'localhost',
      port: Number(env.DATABASE_PORT) || 5432,
      user: env.DATABASE_USER || 'postgres',
      password: env.DATABASE_PASSWORD || 'postgres',
      name: env.DATABASE_NAME || 'cars_db',
      ssl: env.DATABASE_SSL === true,
      url: env.DATABASE_URL,
    },
    logging: {
      level: env.LOG_LEVEL || 'info',
    },
    nhtsa: {
      baseUrl: env.NHTSA_BASE_URL || 'https://vpic.nhtsa.dot.gov/api/vehicles',
      timeoutMs: Number(env.EXTERNAL_API_TIMEOUT_MS) || 15000,
      maxRetries: Number(env.EXTERNAL_API_MAX_RETRIES) || 3,
    },
    ingestion: {
      concurrency: Number(env.INGESTION_CONCURRENCY) || 10,
      defaultLimit:
        env.INGESTION_DEFAULT_LIMIT !== undefined
          ? Number(env.INGESTION_DEFAULT_LIMIT)
          : 50,
      syncOnStartup: Boolean(env.SYNC_ON_STARTUP),
    },
    redis: {
      host: env.REDIS_HOST || '127.0.0.1',
      port: Number(env.REDIS_PORT) || 6379,
      password: env.REDIS_PASSWORD || undefined,
    },
    observe: {
      appKey: env.OBSERVE_APP_KEY,
      appSecret: env.OBSERVE_APP_SECRET,
    },
  };
};
