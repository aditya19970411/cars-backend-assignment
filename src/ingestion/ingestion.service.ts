import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents, Job } from 'bullmq';
import { VehicleMake } from '../database/entities/vehicle-make.entity';
import { VehicleType } from '../database/entities/vehicle-type.entity';
import {
  IngestionRecord,
  IngestionStatus,
} from '../database/entities/ingestion-record.entity';
import { NhtsaApiClient } from './nhtsa-api.client';
import { XmlParserService } from '../transformation/xml-parser.service';
import { AppLogger } from '../logger/app-logger.service';
import { TransformedMake } from '../transformation/types/transformation.types';

export interface IngestionOptions {
  limit?: number;
  offset?: number;
}

export interface IngestionSummary {
  recordId: number;
  status: IngestionStatus;
  totalMakes: number;
  processedMakes: number;
  failedMakes: number;
  durationMs: number;
}

@Injectable()
export class IngestionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private isRunning = false;
  private queueEvents?: QueueEvents;

  constructor(
    @InjectRepository(VehicleMake)
    private readonly makeRepository: Repository<VehicleMake>,
    @InjectRepository(VehicleType)
    private readonly vehicleTypeRepository: Repository<VehicleType>,
    @InjectRepository(IngestionRecord)
    private readonly ingestionRecordRepository: Repository<IngestionRecord>,
    private readonly dataSource: DataSource,
    private readonly nhtsaApiClient: NhtsaApiClient,
    private readonly xmlParserService: XmlParserService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
    @Optional()
    @InjectQueue('vehicle-ingestion')
    private readonly ingestionQueue?: Queue,
  ) {}

  private getQueueEvents(): QueueEvents {
    if (!this.queueEvents) {
      const host = this.configService.get<string>('redis.host') || '127.0.0.1';
      const port = this.configService.get<number>('redis.port') || 6379;
      const password =
        this.configService.get<string>('redis.password') || undefined;

      this.queueEvents = new QueueEvents('vehicle-ingestion', {
        connection: { host, port, password },
      });
    }
    return this.queueEvents;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queueEvents) {
      await this.queueEvents.close().catch(() => {});
      this.queueEvents = undefined;
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    // Clean up any stale in-progress records left by previous interrupted runs/restarts
    await this.ingestionRecordRepository.update(
      { status: IngestionStatus.IN_PROGRESS },
      {
        status: IngestionStatus.FAILED,
        errorMessage: 'Job interrupted by application restart',
        completedAt: new Date(),
      },
    );

    const syncOnStartup = this.configService.get<boolean>(
      'ingestion.syncOnStartup',
    );
    if (syncOnStartup) {
      this.logger.log(
        'SYNC_ON_STARTUP is enabled. Triggering background ingestion...',
      );
      // Run asynchronously in the background so application startup is not blocked
      void this.runIngestion().catch((err) => {
        this.logger.error(
          'Startup ingestion failed',
          err instanceof Error ? err.stack : undefined,
        );
      });
    }
  }

  /**
   * Retrieves the latest ingestion record or default status
   */
  async getLatestStatus(): Promise<IngestionRecord> {
    const latest = await this.ingestionRecordRepository.findOne({
      where: {},
      order: { id: 'DESC' },
    });

    if (latest) {
      return latest;
    }

    const defaultRecord = new IngestionRecord();
    defaultRecord.id = 0;
    defaultRecord.status = IngestionStatus.IDLE;
    defaultRecord.totalMakes = 0;
    defaultRecord.processedMakes = 0;
    defaultRecord.failedMakes = 0;
    return defaultRecord;
  }

  /**
   * Orchestrates the complete XML pull -> transform -> persist pipeline.
   * If BullMQ queue is available, dispatches as an asynchronous queued job.
   */
  async runIngestion(options?: IngestionOptions): Promise<IngestionSummary> {
    if (this.isRunning) {
      throw new Error('An ingestion job is already in progress');
    }

    // If BullMQ is wired up, delegate execution through the queue
    if (this.ingestionQueue) {
      const activeCount = await this.ingestionQueue
        .getActiveCount()
        .catch(() => 0);
      const waitingCount = await this.ingestionQueue
        .getWaitingCount()
        .catch(() => 0);
      if (activeCount > 0 || waitingCount > 0) {
        throw new Error('An ingestion job is already in progress');
      }

      this.isRunning = true;
      const record = this.ingestionRecordRepository.create({
        status: IngestionStatus.IN_PROGRESS,
        totalMakes: 0,
        processedMakes: 0,
        failedMakes: 0,
        startedAt: new Date(),
      });
      const savedRecord = await this.ingestionRecordRepository.save(record);

      try {
        const job = await this.ingestionQueue.add(
          'ingest-makes',
          {
            recordId: savedRecord.id,
            limit: options?.limit,
            offset: options?.offset,
          },
          {
            jobId: `ingestion-${savedRecord.id}`,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );

        const queueEvents = this.getQueueEvents();
        const result = (await job.waitUntilFinished(
          queueEvents,
        )) as IngestionSummary;
        return result;
      } catch (error) {
        throw error;
      } finally {
        this.isRunning = false;
      }
    }

    // Direct in-process execution fallback
    return this.executeIngestionPipeline(options);
  }

  /**
   * Core ingestion pipeline executed by BullMQ Worker (or directly when queue is omitted)
   */
  async executeIngestionPipeline(
    options?: IngestionOptions & { recordId?: number },
    job?: Job,
  ): Promise<IngestionSummary> {
    this.isRunning = true;
    const startTime = Date.now();

    let savedRecord: IngestionRecord;
    if (options?.recordId) {
      const existing = await this.ingestionRecordRepository.findOne({
        where: { id: options.recordId },
      });
      if (existing) {
        savedRecord = existing;
      } else {
        const record = this.ingestionRecordRepository.create({
          status: IngestionStatus.IN_PROGRESS,
          totalMakes: 0,
          processedMakes: 0,
          failedMakes: 0,
          startedAt: new Date(),
        });
        savedRecord = await this.ingestionRecordRepository.save(record);
      }
    } else {
      const record = this.ingestionRecordRepository.create({
        status: IngestionStatus.IN_PROGRESS,
        totalMakes: 0,
        processedMakes: 0,
        failedMakes: 0,
        startedAt: new Date(),
      });
      savedRecord = await this.ingestionRecordRepository.save(record);
    }

    try {
      this.logger.log('Starting ingestion pipeline: pulling all makes XML...');
      const makesXml = await this.nhtsaApiClient.fetchAllMakesXml();
      const allMakes = this.xmlParserService.parseMakesXml(makesXml);

      // Determine batch slice
      const defaultLimit =
        this.configService.get<number>('ingestion.defaultLimit') ?? 50;
      const requestedLimit = options?.limit ?? defaultLimit;
      const offset = options?.offset ?? 0;

      const makesToProcess =
        requestedLimit > 0
          ? allMakes.slice(offset, offset + requestedLimit)
          : allMakes.slice(offset);

      savedRecord.totalMakes = makesToProcess.length;
      await this.ingestionRecordRepository.save(savedRecord);

      this.logger.log(
        `Fetched ${allMakes.length} makes. Processing ${makesToProcess.length} makes with concurrency...`,
      );

      const concurrency =
        this.configService.get<number>('ingestion.concurrency') || 10;

      const transformedMakes: TransformedMake[] = [];
      let processedCount = 0;
      let failedCount = 0;

      // Concurrent processing pool
      const processMake = async (make: {
        makeId: string;
        makeName: string;
      }) => {
        try {
          const typesXml =
            await this.nhtsaApiClient.fetchVehicleTypesForMakeXml(make.makeId);
          const rawTypes = this.xmlParserService.parseVehicleTypesXml(typesXml);
          const transformed = this.xmlParserService.combineMakeWithVehicleTypes(
            make,
            rawTypes,
          );
          transformedMakes.push(transformed);
          processedCount++;
        } catch (error) {
          failedCount++;
          this.logger.logTransformationError(
            `fetchVehicleTypesForMake(${make.makeId})`,
            error,
            { makeId: make.makeId, makeName: make.makeName },
          );
          // Still preserve the make even if types fetch failed
          transformedMakes.push(
            this.xmlParserService.combineMakeWithVehicleTypes(make, []),
          );
        }

        // Live progress update to BullMQ job if running within a worker
        if (job && makesToProcess.length > 0) {
          const progressPercent = Math.round(
            ((processedCount + failedCount) / makesToProcess.length) * 100,
          );
          await job.updateProgress(progressPercent).catch(() => {});
        }
      };

      // Worker pool execution
      await this.executeWithConcurrency(
        makesToProcess,
        processMake,
        concurrency,
      );

      this.logger.log(
        `Transformation complete: ${transformedMakes.length} makes prepared. Persisting to datastore...`,
      );

      // Persist in datastore using transaction for consistency and speed
      await this.persistTransformedMakes(transformedMakes);

      const durationMs = Date.now() - startTime;
      savedRecord.status = IngestionStatus.COMPLETED;
      savedRecord.processedMakes = processedCount;
      savedRecord.failedMakes = failedCount;
      savedRecord.completedAt = new Date();
      await this.ingestionRecordRepository.save(savedRecord);

      this.logger.log(
        `Ingestion completed successfully in ${durationMs}ms. Processed: ${processedCount}, Failed: ${failedCount}`,
      );

      return {
        recordId: savedRecord.id,
        status: IngestionStatus.COMPLETED,
        totalMakes: makesToProcess.length,
        processedMakes: processedCount,
        failedMakes: failedCount,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      savedRecord.status = IngestionStatus.FAILED;
      savedRecord.errorMessage = errorMessage;
      savedRecord.completedAt = new Date();
      await this.ingestionRecordRepository.save(savedRecord);

      this.logger.error(
        `Ingestion failed after ${durationMs}ms: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Persists transformed makes and their vehicle types into the relational datastore
   */
  private async persistTransformedMakes(
    transformedMakes: TransformedMake[],
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const makeData of transformedMakes) {
        // Save or update make
        let make = await queryRunner.manager.findOne(VehicleMake, {
          where: { makeId: makeData.makeId },
        });

        if (!make) {
          make = queryRunner.manager.create(VehicleMake, {
            makeId: makeData.makeId,
            makeName: makeData.makeName,
          });
        } else {
          make.makeName = makeData.makeName;
        }

        await queryRunner.manager.save(VehicleMake, make);

        // Delete previous vehicle types for clean upsert
        await queryRunner.manager.delete(VehicleType, {
          makeId: makeData.makeId,
        });

        // Insert new vehicle types
        if (makeData.vehicleTypes.length > 0) {
          const typeEntities = makeData.vehicleTypes.map((vt) =>
            queryRunner.manager.create(VehicleType, {
              typeId: vt.typeId,
              typeName: vt.typeName,
              makeId: makeData.makeId,
            }),
          );
          await queryRunner.manager.save(VehicleType, typeEntities);
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Failed to persist transformed makes to database, transaction rolled back',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Worker pool to process items concurrently up to maxConcurrency
   */
  private async executeWithConcurrency<T>(
    items: T[],
    worker: (item: T) => Promise<void>,
    concurrency: number,
  ): Promise<void> {
    let index = 0;
    const runners: Promise<void>[] = [];

    const next = async (): Promise<void> => {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
      }
    };

    const workerCount = Math.min(concurrency, items.length);
    for (let i = 0; i < workerCount; i++) {
      runners.push(next());
    }

    await Promise.all(runners);
  }
}
