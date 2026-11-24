import { ArgsType, Field, Int } from '@nestjs/graphql';

@ArgsType()
export class GetMakesArgs {
  @Field(() => Int, {
    nullable: true,
    defaultValue: 50,
    description: 'Maximum number of vehicle makes to return (pagination)',
  })
  limit?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 0,
    description: 'Number of vehicle makes to skip (pagination offset)',
  })
  offset?: number;

  @Field(() => String, {
    nullable: true,
    description:
      'Optional case-insensitive search filter for makeName or makeId',
  })
  search?: string;
}

@ArgsType()
export class GetVehicleTypesArgs {
  @Field(() => String, {
    nullable: true,
    description: 'Filter vehicle types by specific Make ID',
  })
  makeId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Filter vehicle types by specific Type ID (e.g. "1", "2")',
  })
  typeId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Optional filter by vehicle type name',
  })
  search?: string;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 100,
    description: 'Maximum number of vehicle types to return',
  })
  limit?: number;
}
