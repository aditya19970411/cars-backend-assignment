import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { VehicleMake } from '../../database/entities/vehicle-make.entity';
import { VehicleType } from '../../database/entities/vehicle-type.entity';
import { IngestionRecord } from '../../database/entities/ingestion-record.entity';
import { VehiclesService } from '../../vehicles/vehicles.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { GetMakesArgs, GetVehicleTypesArgs } from '../dto/get-makes.args';
import { AppLogger } from '../../logger/app-logger.service';

@Resolver(() => VehicleMake)
export class VehiclesResolver {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly ingestionService: IngestionService,
    private readonly logger: AppLogger,
  ) {}

  @Query(() => [VehicleMake], {
    name: 'makes',
    description:
      'Fetches vehicle makes with their associated vehicle types matching the target unified JSON structure. Supports pagination and search.',
  })
  async getMakes(@Args() args: GetMakesArgs): Promise<VehicleMake[]> {
    this.logger.debug(
      `GraphQL Query: makes (limit=${args.limit}, offset=${args.offset}, search=${args.search})`,
    );
    return this.vehiclesService.getMakes(args);
  }

  @Query(() => VehicleMake, {
    name: 'make',
    nullable: true,
    description:
      'Fetches a single vehicle make with its vehicle types by makeId.',
  })
  async getMake(
    @Args('makeId', { type: () => String, description: 'The unique Make ID' })
    makeId: string,
  ): Promise<VehicleMake | null> {
    this.logger.debug(`GraphQL Query: make (makeId=${makeId})`);
    return this.vehiclesService.getMakeById(makeId);
  }

  @Query(() => [VehicleType], {
    name: 'vehicleTypes',
    description:
      'Fetches vehicle types, optionally filtered by makeId or type name.',
  })
  async getVehicleTypes(
    @Args() args: GetVehicleTypesArgs,
  ): Promise<VehicleType[]> {
    this.logger.debug(
      `GraphQL Query: vehicleTypes (makeId=${args.makeId}, search=${args.search})`,
    );
    return this.vehiclesService.getVehicleTypes(args);
  }

  @Query(() => IngestionRecord, {
    name: 'ingestionStatus',
    description:
      'Returns the status and telemetry of the latest data ingestion run.',
  })
  async getIngestionStatus(): Promise<IngestionRecord> {
    return this.ingestionService.getLatestStatus();
  }

  @Mutation(() => IngestionRecord, {
    name: 'triggerIngestion',
    description:
      'Triggers the NHTSA XML data ingestion pipeline on-demand, fetching, transforming, and persisting vehicle data.',
  })
  async triggerIngestion(
    @Args('limit', {
      type: () => Int,
      nullable: true,
      description:
        'Optional number of makes to ingest (overrides default batch limit)',
    })
    limit?: number,
  ): Promise<IngestionRecord> {
    this.logger.log(
      `GraphQL Mutation: triggerIngestion initiated with limit=${limit}`,
    );
    await this.ingestionService.runIngestion({ limit });
    return this.ingestionService.getLatestStatus();
  }
}
