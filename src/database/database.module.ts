import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VehicleMake } from './entities/vehicle-make.entity';
import { VehicleType } from './entities/vehicle-type.entity';
import { IngestionRecord } from './entities/ingestion-record.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const isDev = configService.get<string>('env') === 'development';
        const useSsl = configService.get<boolean>('database.ssl') === true;
        const dbUrl = configService.get<string>('database.url');

        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities: [VehicleMake, VehicleType, IngestionRecord],
            synchronize: true,
            logging: isDev ? ['error', 'warn'] : false,
            ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
          };
        }

        return {
          type: 'postgres',
          host: configService.get<string>('database.host') || 'localhost',
          port: configService.get<number>('database.port') || 5432,
          username: configService.get<string>('database.user') || 'postgres',
          password:
            configService.get<string>('database.password') || 'postgres',
          database: configService.get<string>('database.name') || 'cars_db',
          entities: [VehicleMake, VehicleType, IngestionRecord],
          synchronize: true,
          logging: isDev ? ['error', 'warn'] : false,
          ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
          extra: {
            max: 10,
          },
        };
      },
    }),
    TypeOrmModule.forFeature([VehicleMake, VehicleType, IngestionRecord]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
