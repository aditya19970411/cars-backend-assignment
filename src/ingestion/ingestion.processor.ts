import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { IngestionService, IngestionSummary } from './ingestion.service';
import { AppLogger } from '../logger/app-logger.service';

export interface IngestionJobPayload {
  recordId?: number;
  limit?: number;
  offset?: number;
}

/**
 * BullMQ Worker Processor for Vehicle Ingestion
 *
 * Responsibilities:
 * - Listens on the 'vehicle-ingestion' queue backed by Redis.
 * - Strictly enforces `concurrency: 1` to guarantee only one ingestion pipeline runs at any time,
 *   preventing overlapping writes and database transaction conflicts.
 * - Enforces distributed token-bucket rate limiting (`limiter`) to ensure calls to upstream NHTSA APIs
 *   remain within safe operational boundaries, preventing Akamai/WAF 429/403 IP bans.
 * - Reports incremental execution progress via BullMQ `job.updateProgress`.
 */
@Injectable()
@Processor('vehicle-ingestion', {
  concurrency: 1, // Enforce single ingestion execution at any time
  limiter: {
    max: 10,       // Max 10 requests per second across all workers
    duration: 1000,
  },
})
export class IngestionProcessor extends WorkerHost {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  /**
   * Dispatched by BullMQ when an ingestion job is picked up by the worker
   */
  async process(job: Job<IngestionJobPayload>): Promise<IngestionSummary> {
    this.logger.log(
      `BullMQ Worker: Starting execution for Job #${job.id} (Record ID: ${job.data.recordId})`,
    );
    return this.ingestionService.executeIngestionPipeline(job.data, job);
  }
}
