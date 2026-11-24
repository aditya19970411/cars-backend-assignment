import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleMake } from '../database/entities/vehicle-make.entity';
import { VehicleType } from '../database/entities/vehicle-type.entity';
import { VehiclesService } from './vehicles.service';
import { VehiclesResolver } from '../graphql/resolvers/vehicles.resolver';
import { IngestionModule } from '../ingestion/ingestion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleMake, VehicleType]),
    IngestionModule,
  ],
  providers: [VehiclesService, VehiclesResolver],
  exports: [VehiclesService],
})
export class VehiclesModule {}
