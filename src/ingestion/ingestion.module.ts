import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleMake } from '../database/entities/vehicle-make.entity';
import { VehicleType } from '../database/entities/vehicle-type.entity';
import { IngestionRecord } from '../database/entities/ingestion-record.entity';
import { NhtsaApiClient } from './nhtsa-api.client';
import { IngestionService } from './ingestion.service';
import { TransformationModule } from '../transformation/transformation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleMake, VehicleType, IngestionRecord]),
    TransformationModule,
  ],
  providers: [NhtsaApiClient, IngestionService],
  exports: [IngestionService, NhtsaApiClient],
})
export class IngestionModule {}
