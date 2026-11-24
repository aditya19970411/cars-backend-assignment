import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleMake } from '../../src/database/entities/vehicle-make.entity';
import { VehicleType } from '../../src/database/entities/vehicle-type.entity';
import { IngestionRecord } from '../../src/database/entities/ingestion-record.entity';
import { createTestDatabase } from './test-database';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        entities: [VehicleMake, VehicleType, IngestionRecord],
        synchronize: true,
      }),
      dataSourceFactory: async () => createTestDatabase(),
    }),
    TypeOrmModule.forFeature([VehicleMake, VehicleType, IngestionRecord]),
  ],
  exports: [TypeOrmModule],
})
export class TestDatabaseModule {}
