import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  let logger: AppLogger;

  beforeEach(() => {
    logger = new AppLogger();
  });

  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should log standard messages without throwing', () => {
    expect(() => logger.log('Test info log')).not.toThrow();
    expect(() => logger.warn('Test warn log')).not.toThrow();
    expect(() => logger.debug('Test debug log')).not.toThrow();
    expect(() => logger.error('Test error log', 'mock trace')).not.toThrow();
  });

  it('should log API failures with structured metadata', () => {
    expect(() =>
      logger.logApiFailure(
        'https://vpic.nhtsa.dot.gov/test',
        new Error('Network timeout'),
        {
          statusCode: 504,
          attempt: 3,
        },
      ),
    ).not.toThrow();
  });

  it('should log transformation errors with metadata', () => {
    expect(() =>
      logger.logTransformationError(
        'xmlToJson',
        new Error('Malformed XML input'),
        {
          inputLength: 120,
        },
      ),
    ).not.toThrow();
  });

  it('should log lifecycle events', () => {
    expect(() =>
      logger.logLifecycleEvent('startup', {
        port: 3000,
        env: 'test',
      }),
    ).not.toThrow();
  });
});
