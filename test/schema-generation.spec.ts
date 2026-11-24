import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from '../src/app.module';
import { DatabaseModule } from '../src/database/database.module';
import { TestDatabaseModule } from './test-utils/test-database.module';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { IngestionProcessor } from '../src/ingestion/ingestion.processor';
import * as fs from 'fs';
import * as path from 'path';

describe('GraphQL Schema Generation', () => {
  it('should generate schema.gql on startup', async () => {
    process.env.NODE_ENV = 'test';
    process.env.SYNC_ON_STARTUP = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(TestDatabaseModule)
      .overrideProvider(IngestionService)
      .useValue({
        onApplicationBootstrap: jest.fn(),
        getLatestStatus: jest.fn(async () => ({})),
        runIngestion: jest.fn(),
      })
      .overrideProvider(IngestionProcessor)
      .useValue({
        process: jest.fn(),
      })
      .overrideProvider(getQueueToken('vehicle-ingestion'))
      .useValue({
        add: jest.fn(),
        getActiveCount: jest.fn(async () => 0),
        getWaitingCount: jest.fn(async () => 0),
        close: jest.fn(async () => {}),
      })
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const schemaPath = path.resolve(process.cwd(), 'schema.gql');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    expect(schemaContent).toContain('type VehicleMake');
    expect(schemaContent).toContain('type VehicleType');
    expect(schemaContent).toContain('type IngestionRecord');
    expect(schemaContent).toContain('makes(');
    expect(schemaContent).toContain('triggerIngestion(');

    await app.close();
  });
});
