import { EnvConfig } from './env.validation';

export interface AppConfig {
  env: string;
  port: number;
  database: {
    path: string;
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
      path: env.DATABASE_PATH || './data/vehicles.sqlite',
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
    observe: {
      appKey: env.OBSERVE_APP_KEY,
      appSecret: env.OBSERVE_APP_SECRET,
    },
  };
};
