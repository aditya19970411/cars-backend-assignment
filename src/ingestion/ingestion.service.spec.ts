import { jest } from '@jest/globals';
import { DataSource, Repository } from 'typeorm';
import { IngestionService } from './ingestion.service';
import { NhtsaApiClient } from './nhtsa-api.client';
import { XmlParserService } from '../transformation/xml-parser.service';
import { AppLogger } from '../logger/app-logger.service';
import { ConfigService } from '@nestjs/config';
import { VehicleMake } from '../database/entities/vehicle-make.entity';
import { VehicleType } from '../database/entities/vehicle-type.entity';
import {
  IngestionRecord,
  IngestionStatus,
} from '../database/entities/ingestion-record.entity';

describe('IngestionService', () => {
  let service: IngestionService;
  let dataSource: DataSource;
  let makeRepo: Repository<VehicleMake>;
  let typeRepo: Repository<VehicleType>;
  let recordRepo: Repository<IngestionRecord>;
  let nhtsaClientMock: jest.Mocked<NhtsaApiClient>;
  let xmlParserService: XmlParserService;
  let configServiceMock: jest.Mocked<ConfigService>;
  let loggerMock: jest.Mocked<AppLogger>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [VehicleMake, VehicleType, IngestionRecord],
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
    makeRepo = dataSource.getRepository(VehicleMake);
    typeRepo = dataSource.getRepository(VehicleType);
    recordRepo = dataSource.getRepository(IngestionRecord);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await typeRepo.clear();
    await makeRepo.clear();
    await recordRepo.clear();

    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      logTransformationError: jest.fn(),
      logApiFailure: jest.fn(),
      logLifecycleEvent: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    xmlParserService = new XmlParserService(loggerMock);

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'ingestion.defaultLimit') return 5;
        if (key === 'ingestion.concurrency') return 2;
        if (key === 'ingestion.syncOnStartup') return false;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    nhtsaClientMock = {
      fetchAllMakesXml: jest.fn(
        async () => `
        <Response>
          <Results>
            <AllVehicleMakes><Make_ID>440</Make_ID><Make_Name>ASTON MARTIN</Make_Name></AllVehicleMakes>
            <AllVehicleMakes><Make_ID>441</Make_ID><Make_Name>TESLA</Make_Name></AllVehicleMakes>
          </Results>
        </Response>
      `,
      ),
      fetchVehicleTypesForMakeXml: jest.fn(async (makeId: string) => {
        if (makeId === '440') {
          return `
            <Response>
              <Results>
                <VehicleTypesForMakeIds><VehicleTypeId>2</VehicleTypeId><VehicleTypeName>Passenger Car</VehicleTypeName></VehicleTypesForMakeIds>
                <VehicleTypesForMakeIds><VehicleTypeId>7</VehicleTypeId><VehicleTypeName>Multipurpose Passenger Vehicle (MPV)</VehicleTypeName></VehicleTypesForMakeIds>
              </Results>
            </Response>
          `;
        }
        return `
          <Response>
            <Results>
              <VehicleTypesForMakeIds><VehicleTypeId>2</VehicleTypeId><VehicleTypeName>Passenger Car</VehicleTypeName></VehicleTypesForMakeIds>
            </Results>
          </Response>
        `;
      }),
    } as unknown as jest.Mocked<NhtsaApiClient>;

    service = new IngestionService(
      makeRepo,
      typeRepo,
      recordRepo,
      dataSource,
      nhtsaClientMock,
      xmlParserService,
      configServiceMock,
      loggerMock,
    );
  });

  it('should run end-to-end ingestion and persist makes with vehicle types', async () => {
    const summary = await service.runIngestion({ limit: 2 });

    expect(summary.status).toBe(IngestionStatus.COMPLETED);
    expect(summary.totalMakes).toBe(2);
    expect(summary.processedMakes).toBe(2);
    expect(summary.failedMakes).toBe(0);

    const savedMakes = await makeRepo.find({
      order: { makeId: 'ASC' },
      relations: { vehicleTypes: true },
    });

    expect(savedMakes).toHaveLength(2);
    expect(savedMakes[0].makeId).toBe('440');
    expect(savedMakes[0].makeName).toBe('ASTON MARTIN');
    expect(savedMakes[0].vehicleTypes).toHaveLength(2);

    expect(savedMakes[1].makeId).toBe('441');
    expect(savedMakes[1].makeName).toBe('TESLA');
    expect(savedMakes[1].vehicleTypes).toHaveLength(1);
  });

  it('should be resilient when an individual make vehicle types fetch fails', async () => {
    nhtsaClientMock.fetchVehicleTypesForMakeXml = jest.fn(
      async (makeId: string) => {
        if (makeId === '441') {
          throw new Error('NHTSA timeout for make 441');
        }
        return `
        <Response>
          <Results>
            <VehicleTypesForMakeIds><VehicleTypeId>2</VehicleTypeId><VehicleTypeName>Passenger Car</VehicleTypeName></VehicleTypesForMakeIds>
          </Results>
        </Response>
      `;
      },
    );

    const summary = await service.runIngestion({ limit: 2 });

    expect(summary.status).toBe(IngestionStatus.COMPLETED);
    expect(summary.processedMakes).toBe(1);
    expect(summary.failedMakes).toBe(1);

    const savedMakes = await makeRepo.find({
      relations: { vehicleTypes: true },
    });
    expect(savedMakes).toHaveLength(2);
  });

  it('should prevent concurrent overlapping ingestion runs', async () => {
    const promise1 = service.runIngestion({ limit: 2 });
    await expect(service.runIngestion({ limit: 2 })).rejects.toThrow(
      'An ingestion job is already in progress',
    );
    await promise1;
  });

  it('should report latest ingestion status', async () => {
    const statusBefore = await service.getLatestStatus();
    expect(statusBefore.status).toBe(IngestionStatus.IDLE);

    await service.runIngestion({ limit: 1 });

    const statusAfter = await service.getLatestStatus();
    expect(statusAfter.status).toBe(IngestionStatus.COMPLETED);
    expect(statusAfter.processedMakes).toBe(1);
  });
});
