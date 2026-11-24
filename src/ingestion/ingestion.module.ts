import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { VehicleMake } from '../database/entities/vehicle-make.entity';
import { VehicleType } from '../database/entities/vehicle-type.entity';
import { IngestionRecord } from '../database/entities/ingestion-record.entity';
import { NhtsaApiClient } from './nhtsa-api.client';
import { IngestionService } from './ingestion.service';
import { IngestionProcessor } from './ingestion.processor';
import { TransformationModule } from '../transformation/transformation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleMake, VehicleType, IngestionRecord]),
    // Registers BullMQ queue backed by Redis with automated retry and retention policy
    BullModule.registerQueue({
      name: 'vehicle-ingestion',
      defaultJobOptions: {
        removeOnComplete: 100, // Retain last 100 completed jobs for audit telemetry
        removeOnFail: 500, // Retain last 500 failed jobs for diagnostics
        attempts: 2, // Retry once on transient network failures
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
    TransformationModule,
  ],
  providers: [NhtsaApiClient, IngestionService, IngestionProcessor],
  exports: [IngestionService, NhtsaApiClient, BullModule],
})
export class IngestionModule {}
