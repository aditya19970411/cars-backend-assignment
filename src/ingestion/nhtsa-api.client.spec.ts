import { jest } from '@jest/globals';
import { NhtsaApiClient } from './nhtsa-api.client';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../logger/app-logger.service';
import { ExternalApiException } from '../common/exceptions/ingestion.exceptions';

describe('NhtsaApiClient', () => {
  let client: NhtsaApiClient;
  let configServiceMock: jest.Mocked<ConfigService>;
  let loggerMock: jest.Mocked<AppLogger>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'nhtsa.baseUrl') return 'https://mock.nhtsa.api';
        if (key === 'nhtsa.timeoutMs') return 1000;
        if (key === 'nhtsa.maxRetries') return 2;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      logApiFailure: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    client = new NhtsaApiClient(configServiceMock, loggerMock);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fetch all makes XML successfully', async () => {
    const mockXml =
      '<Response><Results><AllVehicleMakes><Make_ID>440</Make_ID></AllVehicleMakes></Results></Response>';
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => mockXml,
    })) as unknown as typeof fetch;

    const result = await client.fetchAllMakesXml();
    expect(result).toBe(mockXml);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mock.nhtsa.api/getallmakes?format=XML',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('should fetch vehicle types for make XML successfully', async () => {
    const mockXml =
      '<Response><Results><VehicleTypesForMakeIds><VehicleTypeId>2</VehicleTypeId></VehicleTypesForMakeIds></Results></Response>';
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => mockXml,
    })) as unknown as typeof fetch;

    const result = await client.fetchVehicleTypesForMakeXml('440');
    expect(result).toBe(mockXml);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mock.nhtsa.api/GetVehicleTypesForMakeId/440?format=xml',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('should retry on failure and succeed if subsequent attempt works', async () => {
    const mockXml = '<Response><Success/></Response>';
    let callCount = 0;
    global.fetch = jest.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Transient network error');
      }
      return {
        ok: true,
        text: async () => mockXml,
      };
    }) as unknown as typeof fetch;

    const result = await client.fetchAllMakesXml();
    expect(result).toBe(mockXml);
    expect(callCount).toBe(2);
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it('should throw ExternalApiException if max retries exceeded', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('Persistent network failure');
    }) as unknown as typeof fetch;

    await expect(client.fetchAllMakesXml()).rejects.toThrow(
      ExternalApiException,
    );
    expect(loggerMock.logApiFailure).toHaveBeenCalled();
  });

  it('should throw ExternalApiException on non-200 HTTP response', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    })) as unknown as typeof fetch;

    await expect(client.fetchAllMakesXml()).rejects.toThrow(
      ExternalApiException,
    );
  });
});
