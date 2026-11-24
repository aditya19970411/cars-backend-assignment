import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
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

    // Relational Persistent Datastore (SQLite / TypeORM)
    DatabaseModule,

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
