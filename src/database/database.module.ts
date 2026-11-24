import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { VehicleMake } from './entities/vehicle-make.entity';
import { VehicleType } from './entities/vehicle-type.entity';
import { IngestionRecord } from './entities/ingestion-record.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const dbPath =
          configService.get<string>('database.path') ||
          './data/vehicles.sqlite';

        if (dbPath !== ':memory:') {
          const absolutePath = path.isAbsolute(dbPath)
            ? dbPath
            : path.resolve(process.cwd(), dbPath);
          const dir = path.dirname(absolutePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        const isDev = configService.get<string>('env') === 'development';
        const options: TypeOrmModuleOptions = {
          type: 'better-sqlite3',
          database: dbPath,
          entities: [VehicleMake, VehicleType, IngestionRecord],
          synchronize: true,
          logging: isDev ? ['error', 'warn'] : false,
        };

        return options;
      },
    }),
    TypeOrmModule.forFeature([VehicleMake, VehicleType, IngestionRecord]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
