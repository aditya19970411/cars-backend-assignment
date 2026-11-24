import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { IngestionService } from '../src/ingestion/ingestion.service';
import * as fs from 'fs';
import * as path from 'path';

describe('GraphQL Schema Generation', () => {
  it('should generate schema.gql on startup', async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.SYNC_ON_STARTUP = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IngestionService)
      .useValue({
        onApplicationBootstrap: jest.fn(),
        getLatestStatus: jest.fn(async () => ({})),
        runIngestion: jest.fn(),
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
