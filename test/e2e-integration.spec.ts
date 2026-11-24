import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { VehicleMake } from '../src/database/entities/vehicle-make.entity';
import { VehicleType } from '../src/database/entities/vehicle-type.entity';
import { IngestionRecord } from '../src/database/entities/ingestion-record.entity';
import { TransformationModule } from '../src/transformation/transformation.module';
import { IngestionModule } from '../src/ingestion/ingestion.module';
import { VehiclesModule } from '../src/vehicles/vehicles.module';
import { LoggerModule } from '../src/logger/logger.module';
import { NhtsaApiClient } from '../src/ingestion/nhtsa-api.client';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { VehiclesResolver } from '../src/graphql/resolvers/vehicles.resolver';
import { createTestDatabase } from './test-utils/test-database';

describe('E2E Data Pipeline: Ingestion -> Persistence -> GraphQL Serving', () => {
  let moduleRef: TestingModule;
  let ingestionService: IngestionService;
  let vehiclesResolver: VehiclesResolver;
  let nhtsaClientMock: {
    fetchAllMakesXml: jest.MockedFunction<() => Promise<string>>;
    fetchVehicleTypesForMakeXml: jest.MockedFunction<
      (makeId: string) => Promise<string>
    >;
  };

  const sampleMakesXml = `
    <Response xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
      <Count>2</Count>
      <Message>Response returned successfully</Message>
      <Results>
        <AllVehicleMakes>
          <Make_ID>440</Make_ID>
          <Make_Name>ASTON MARTIN</Make_Name>
        </AllVehicleMakes>
        <AllVehicleMakes>
          <Make_ID>482</Make_ID>
          <Make_Name>VOLKSWAGEN</Make_Name>
        </AllVehicleMakes>
      </Results>
    </Response>
  `;

  const sampleTypesAstonMartinXml = `
    <Response>
      <Count>2</Count>
      <Message>Response returned successfully</Message>
      <SearchCriteria>Make ID: 440</SearchCriteria>
      <Results>
        <VehicleTypesForMakeIds>
          <VehicleTypeId>2</VehicleTypeId>
          <VehicleTypeName>Passenger Car</VehicleTypeName>
        </VehicleTypesForMakeIds>
        <VehicleTypesForMakeIds>
          <VehicleTypeId>7</VehicleTypeId>
          <VehicleTypeName>Multipurpose Passenger Vehicle (MPV)</VehicleTypeName>
        </VehicleTypesForMakeIds>
      </Results>
    </Response>
  `;

  const sampleTypesVolkswagenXml = `
    <Response>
      <Count>3</Count>
      <Message>Response returned successfully</Message>
      <SearchCriteria>Make ID: 482</SearchCriteria>
      <Results>
        <VehicleTypesForMakeIds>
          <VehicleTypeId>2</VehicleTypeId>
          <VehicleTypeName>Passenger Car</VehicleTypeName>
        </VehicleTypesForMakeIds>
        <VehicleTypesForMakeIds>
          <VehicleTypeId>3</VehicleTypeId>
          <VehicleTypeName>Truck</VehicleTypeName>
        </VehicleTypesForMakeIds>
        <VehicleTypesForMakeIds>
          <VehicleTypeId>7</VehicleTypeId>
          <VehicleTypeName>Multipurpose Passenger Vehicle (MPV)</VehicleTypeName>
        </VehicleTypesForMakeIds>
      </Results>
    </Response>
  `;

  beforeAll(async () => {
    nhtsaClientMock = {
      fetchAllMakesXml: jest.fn(async () => sampleMakesXml),
      fetchVehicleTypesForMakeXml: jest.fn(async (makeId: string) => {
        if (makeId === '440') return sampleTypesAstonMartinXml;
        if (makeId === '482') return sampleTypesVolkswagenXml;
        return '<Response><Results/></Response>';
      }),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              env: 'test',
              database: {
                host: 'localhost',
                port: 5432,
                user: 'postgres',
                password: 'postgres',
                name: 'cars_db_test',
                ssl: false,
              },
              ingestion: {
                concurrency: 2,
                defaultLimit: 10,
                syncOnStartup: false,
              },
            }),
          ],
        }),
        LoggerModule,
        TypeOrmModule.forRootAsync({
          useFactory: () => ({
            type: 'postgres',
            entities: [VehicleMake, VehicleType, IngestionRecord],
            synchronize: true,
          }),
          dataSourceFactory: async () => createTestDatabase(),
        }),
        TransformationModule,
        IngestionModule,
        VehiclesModule,
      ],
    })
      .overrideProvider(NhtsaApiClient)
      .useValue(nhtsaClientMock)
      .overrideProvider(getQueueToken('vehicle-ingestion'))
      .useValue(null)
      .compile();

    ingestionService = moduleRef.get(IngestionService);
    vehiclesResolver = moduleRef.get(VehiclesResolver);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('Step 1: Ingestion runs, pulls XML, transforms and persists into datastore', async () => {
    const summary = await ingestionService.runIngestion({ limit: 2 });

    expect(summary.totalMakes).toBe(2);
    expect(summary.processedMakes).toBe(2);
    expect(summary.failedMakes).toBe(0);
  });

  it('Step 2: GraphQL queries return the transformed structure matching the gist schema', async () => {
    const makes = await vehiclesResolver.getMakes({ limit: 10, offset: 0 });

    expect(makes).toHaveLength(2);

    const astonMartin = makes.find((m) => m.makeId === '440');
    expect(astonMartin).toBeDefined();
    expect(astonMartin?.makeName).toBe('ASTON MARTIN');
    expect(astonMartin?.vehicleTypes).toHaveLength(2);

    // Verify exact shape: { makeId, makeName, vehicleTypes: [{ typeId, typeName }] }
    expect(astonMartin?.vehicleTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          typeId: '2',
          typeName: 'Passenger Car',
        }),
        expect.objectContaining({
          typeId: '7',
          typeName: 'Multipurpose Passenger Vehicle (MPV)',
        }),
      ]),
    );

    const volkswagen = makes.find((m) => m.makeId === '482');
    expect(volkswagen).toBeDefined();
    expect(volkswagen?.vehicleTypes).toHaveLength(3);
  });

  it('Step 3: GraphQL single make query by ID retrieves details', async () => {
    const make = await vehiclesResolver.getMake('440');
    expect(make).not.toBeNull();
    expect(make?.makeId).toBe('440');
    expect(make?.makeName).toBe('ASTON MARTIN');
  });

  it('Step 4: GraphQL vehicleTypes query returns vehicle types for specific make', async () => {
    const types = await vehiclesResolver.getVehicleTypes({ makeId: '440' });
    expect(types).toHaveLength(2);
    expect(types.map((t) => t.typeName)).toContain('Passenger Car');
    expect(types.map((t) => t.typeName)).toContain(
      'Multipurpose Passenger Vehicle (MPV)',
    );
  });

  it('Step 5: GraphQL ingestionStatus returns completed operational telemetry', async () => {
    const status = await vehiclesResolver.getIngestionStatus();
    expect(status.status).toBe('COMPLETED');
    expect(status.processedMakes).toBe(2);
    expect(status.totalMakes).toBe(2);
  });
});
