import { newDb, DataType } from 'pg-mem';
import { DataSource } from 'typeorm';
import { VehicleMake } from '../../src/database/entities/vehicle-make.entity';
import { VehicleType } from '../../src/database/entities/vehicle-type.entity';
import { IngestionRecord } from '../../src/database/entities/ingestion-record.entity';

export async function createTestDatabase(): Promise<DataSource> {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.0 (pg-mem)',
  });

  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'cars_db_test',
  });

  db.public.registerFunction({
    name: 'quote_ident',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (val: string) => val,
  });

  db.public.registerFunction({
    name: 'obj_description',
    args: [DataType.regclass, DataType.text],
    returns: DataType.text,
    implementation: () => null,
  });

  const dataSource: DataSource = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [VehicleMake, VehicleType, IngestionRecord],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
}
