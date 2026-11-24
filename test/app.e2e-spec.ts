import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getQueueToken } from '@nestjs/bullmq';
import { IngestionProcessor } from './../src/ingestion/ingestion.processor';
import { IngestionService } from './../src/ingestion/ingestion.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.SYNC_ON_STARTUP = 'false';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IngestionService)
      .useValue({
        onApplicationBootstrap: () => Promise.resolve(),
      })
      .overrideProvider(IngestionProcessor)
      .useValue({
        process: () => Promise.resolve(),
      })
      .overrideProvider(getQueueToken('vehicle-ingestion'))
      .useValue({
        add: () => Promise.resolve(),
        getActiveCount: () => Promise.resolve(0),
        getWaitingCount: () => Promise.resolve(0),
        close: () => Promise.resolve(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
