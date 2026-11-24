import { jest } from '@jest/globals';
import { Job } from 'bullmq';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionService, IngestionSummary } from './ingestion.service';
import { IngestionStatus } from '../database/entities/ingestion-record.entity';
import { AppLogger } from '../logger/app-logger.service';

describe('IngestionProcessor', () => {
  let processor: IngestionProcessor;
  let ingestionServiceMock: jest.Mocked<IngestionService>;
  let loggerMock: jest.Mocked<AppLogger>;

  beforeEach(() => {
    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    ingestionServiceMock = {
      executeIngestionPipeline: jest.fn(),
    } as unknown as jest.Mocked<IngestionService>;

    processor = new IngestionProcessor(ingestionServiceMock, loggerMock);
  });

  it('should process a queued BullMQ job and delegate to executeIngestionPipeline', async () => {
    const mockSummary: IngestionSummary = {
      recordId: 1,
      status: IngestionStatus.COMPLETED,
      totalMakes: 10,
      processedMakes: 10,
      failedMakes: 0,
      durationMs: 150,
    };

    ingestionServiceMock.executeIngestionPipeline.mockResolvedValue(
      mockSummary,
    );

    const mockJob = {
      id: 'job-1',
      data: { recordId: 1, limit: 10 },
      updateProgress: jest.fn(),
    } as unknown as Job;

    const result = await processor.process(mockJob);

    expect(result).toEqual(mockSummary);
    expect(ingestionServiceMock.executeIngestionPipeline).toHaveBeenCalledWith(
      { recordId: 1, limit: 10 },
      mockJob,
    );
  });
});
