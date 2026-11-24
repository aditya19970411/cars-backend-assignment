import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bullmq';
import { createObserveModule } from '@nestjs/observe';
import { validateEnv } from './config/env.validation';
import { configuration } from './config/configuration';
import { LoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { TransformationModule } from './transformation/transformation.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Configuration Module with Zod validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [configuration],
    }),

    // Structured JSON Logger
    LoggerModule,

    // Relational Persistent Datastore (PostgreSQL / TypeORM)
    DatabaseModule,

    // Asynchronous Queue Engine (BullMQ + Redis)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host') || '127.0.0.1',
          port: configService.get<number>('redis.port') || 6379,
          password: configService.get<string>('redis.password') || undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
      }),
    }),

    // GraphQL Engine (Apollo Driver, code-first schema generation)
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      sortSchema: true,
      playground: true,
      introspection: true,
    }),

    // Core Business Modules
    TransformationModule,
    IngestionModule,
    VehiclesModule,

    // Observability Telemetry
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'cars-backend-challenge',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
