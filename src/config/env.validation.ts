import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'staging'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default('./data/vehicles.sqlite'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  NHTSA_BASE_URL: z
    .string()
    .url()
    .default('https://vpic.nhtsa.dot.gov/api/vehicles'),
  INGESTION_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(10),
  INGESTION_DEFAULT_LIMIT: z.coerce.number().int().min(0).default(50),
  SYNC_ON_STARTUP: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default(false),
  EXTERNAL_API_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),
  EXTERNAL_API_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  OBSERVE_APP_KEY: z.string().optional(),
  OBSERVE_APP_SECRET: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues ?? [];
    const errorDetails = issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Configuration validation error: ${errorDetails}`);
  }

  return result.data;
}
