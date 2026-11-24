import { jest } from '@jest/globals';
import { VehiclesResolver } from './vehicles.resolver';
import { VehiclesService } from '../../vehicles/vehicles.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { AppLogger } from '../../logger/app-logger.service';
import { VehicleMake } from '../../database/entities/vehicle-make.entity';
import {
  IngestionRecord,
  IngestionStatus,
} from '../../database/entities/ingestion-record.entity';

describe('VehiclesResolver', () => {
  let resolver: VehiclesResolver;
  let vehiclesServiceMock: jest.Mocked<VehiclesService>;
  let ingestionServiceMock: jest.Mocked<IngestionService>;
  let loggerMock: jest.Mocked<AppLogger>;

  beforeEach(() => {
    vehiclesServiceMock = {
      getMakes: jest.fn(async () => [
        {
          makeId: '440',
          makeName: 'ASTON MARTIN',
          vehicleTypes: [{ typeId: '2', typeName: 'Passenger Car' }],
        } as unknown as VehicleMake,
      ]),
      getMakeById: jest.fn(async (id: string) => {
        if (id === '440') {
          return {
            makeId: '440',
            makeName: 'ASTON MARTIN',
            vehicleTypes: [],
          } as unknown as VehicleMake;
        }
        return null;
      }),
      getVehicleTypes: jest.fn(async () => []),
      countMakes: jest.fn(async () => 1),
    } as unknown as jest.Mocked<VehiclesService>;

    ingestionServiceMock = {
      runIngestion: jest.fn(async () => ({
        recordId: 1,
        status: IngestionStatus.COMPLETED,
        totalMakes: 1,
        processedMakes: 1,
        failedMakes: 0,
        durationMs: 50,
      })),
      getLatestStatus: jest.fn(
        async () =>
          ({
            id: 1,
            status: IngestionStatus.COMPLETED,
            totalMakes: 1,
            processedMakes: 1,
            failedMakes: 0,
          }) as unknown as IngestionRecord,
      ),
    } as unknown as jest.Mocked<IngestionService>;

    loggerMock = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    resolver = new VehiclesResolver(
      vehiclesServiceMock,
      ingestionServiceMock,
      loggerMock,
    );
  });

  it('should query makes with arguments', async () => {
    const results = await resolver.getMakes({ limit: 10, offset: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].makeId).toBe('440');
    expect(vehiclesServiceMock.getMakes).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
    });
  });

  it('should query single make by ID', async () => {
    const result = await resolver.getMake('440');
    expect(result).toBeDefined();
    expect(result?.makeName).toBe('ASTON MARTIN');
    expect(vehiclesServiceMock.getMakeById).toHaveBeenCalledWith('440');
  });

  it('should query ingestion status', async () => {
    const status = await resolver.getIngestionStatus();
    expect(status.status).toBe(IngestionStatus.COMPLETED);
    expect(ingestionServiceMock.getLatestStatus).toHaveBeenCalled();
  });

  it('should trigger ingestion mutation and return latest status', async () => {
    const result = await resolver.triggerIngestion(25);
    expect(ingestionServiceMock.runIngestion).toHaveBeenCalledWith({
      limit: 25,
    });
    expect(result.status).toBe(IngestionStatus.COMPLETED);
  });
});
