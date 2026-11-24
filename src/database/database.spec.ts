import { DataSource } from 'typeorm';
import { VehicleMake } from './entities/vehicle-make.entity';
import {
  IngestionRecord,
  IngestionStatus,
} from './entities/ingestion-record.entity';
import { createTestDatabase } from '../../test/test-utils/test-database';

describe('Database Entities and Repositories', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await createTestDatabase();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM vehicle_types;');
    await dataSource.query('DELETE FROM vehicle_makes;');
    await dataSource.query('DELETE FROM ingestion_records;');
  });

  it('should persist a VehicleMake with associated VehicleTypes', async () => {
    const makeRepo = dataSource.getRepository(VehicleMake);

    const make = makeRepo.create({
      makeId: '440',
      makeName: 'ASTON MARTIN',
      vehicleTypes: [
        {
          typeId: '2',
          typeName: 'Passenger Car',
          makeId: '440',
        },
        {
          typeId: '7',
          typeName: 'Multipurpose Passenger Vehicle (MPV)',
          makeId: '440',
        },
      ],
    });

    await makeRepo.save(make);

    const saved = await makeRepo.findOne({
      where: { makeId: '440' },
      relations: { vehicleTypes: true },
    });

    expect(saved).toBeDefined();
    expect(saved?.makeId).toBe('440');
    expect(saved?.makeName).toBe('ASTON MARTIN');
    expect(saved?.vehicleTypes).toHaveLength(2);
    expect(saved?.vehicleTypes.map((t) => t.typeName)).toContain(
      'Passenger Car',
    );
    expect(saved?.vehicleTypes.map((t) => t.typeName)).toContain(
      'Multipurpose Passenger Vehicle (MPV)',
    );
  });

  it('should persist and update IngestionRecord', async () => {
    const recordRepo = dataSource.getRepository(IngestionRecord);

    const record = recordRepo.create({
      status: IngestionStatus.IN_PROGRESS,
      totalMakes: 50,
      processedMakes: 0,
      failedMakes: 0,
      startedAt: new Date(),
    });

    const saved = await recordRepo.save(record);
    expect(saved.id).toBeDefined();
    expect(saved.status).toBe(IngestionStatus.IN_PROGRESS);

    saved.processedMakes = 50;
    saved.status = IngestionStatus.COMPLETED;
    saved.completedAt = new Date();

    const updated = await recordRepo.save(saved);
    expect(updated.status).toBe(IngestionStatus.COMPLETED);
    expect(updated.processedMakes).toBe(50);
  });
});
