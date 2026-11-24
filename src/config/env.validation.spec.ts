import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('should validate and apply defaults for empty configuration', () => {
    const config = validateEnv({});
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_HOST).toBe('localhost');
    expect(config.DATABASE_PORT).toBe(5432);
    expect(config.DATABASE_USER).toBe('postgres');
    expect(config.DATABASE_PASSWORD).toBe('postgres');
    expect(config.DATABASE_NAME).toBe('cars_db');
    expect(config.DATABASE_SSL).toBe(false);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.NHTSA_BASE_URL).toBe(
      'https://vpic.nhtsa.dot.gov/api/vehicles',
    );
    expect(config.INGESTION_CONCURRENCY).toBe(10);
    expect(config.INGESTION_DEFAULT_LIMIT).toBe(50);
    expect(config.SYNC_ON_STARTUP).toBe(false);
    expect(config.REDIS_HOST).toBe('127.0.0.1');
    expect(config.REDIS_PORT).toBe(6379);
  });

  it('should parse valid custom environment variables', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_HOST: 'postgres.internal',
      DATABASE_PORT: '5433',
      DATABASE_USER: 'custom_user',
      DATABASE_PASSWORD: 'custom_password',
      DATABASE_NAME: 'custom_cars',
      DATABASE_SSL: 'true',
      LOG_LEVEL: 'warn',
      NHTSA_BASE_URL: 'https://custom.api.gov/vehicles',
      INGESTION_CONCURRENCY: '5',
      INGESTION_DEFAULT_LIMIT: '100',
      SYNC_ON_STARTUP: 'true',
      REDIS_HOST: 'redis.internal',
      REDIS_PORT: '6380',
      EXTERNAL_API_TIMEOUT_MS: '20000',
      EXTERNAL_API_MAX_RETRIES: '5',
    });

    expect(config.NODE_ENV).toBe('production');
    expect(config.PORT).toBe(8080);
    expect(config.DATABASE_HOST).toBe('postgres.internal');
    expect(config.DATABASE_PORT).toBe(5433);
    expect(config.DATABASE_USER).toBe('custom_user');
    expect(config.DATABASE_PASSWORD).toBe('custom_password');
    expect(config.DATABASE_NAME).toBe('custom_cars');
    expect(config.DATABASE_SSL).toBe(true);
    expect(config.LOG_LEVEL).toBe('warn');
    expect(config.NHTSA_BASE_URL).toBe('https://custom.api.gov/vehicles');
    expect(config.INGESTION_CONCURRENCY).toBe(5);
    expect(config.INGESTION_DEFAULT_LIMIT).toBe(100);
    expect(config.SYNC_ON_STARTUP).toBe(true);
    expect(config.REDIS_HOST).toBe('redis.internal');
    expect(config.REDIS_PORT).toBe(6380);
    expect(config.EXTERNAL_API_TIMEOUT_MS).toBe(20000);
    expect(config.EXTERNAL_API_MAX_RETRIES).toBe(5);
  });

  it('should throw an error for invalid environment variables', () => {
    expect(() =>
      validateEnv({
        PORT: 'not-a-number',
      }),
    ).toThrow('Configuration validation error');

    expect(() =>
      validateEnv({
        NHTSA_BASE_URL: 'invalid-url',
      }),
    ).toThrow('Configuration validation error');

    expect(() =>
      validateEnv({
        LOG_LEVEL: 'unsupported-log-level',
      }),
    ).toThrow('Configuration validation error');
  });
});
