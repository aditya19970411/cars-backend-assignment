import { DataSource, Repository } from 'typeorm';
import { VehiclesService } from './vehicles.service';
import { VehicleMake } from '../database/entities/vehicle-make.entity';
import { VehicleType } from '../database/entities/vehicle-type.entity';
import { createTestDatabase } from '../../test/test-utils/test-database';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let dataSource: DataSource;
  let makeRepo: Repository<VehicleMake>;
  let typeRepo: Repository<VehicleType>;

  beforeAll(async () => {
    dataSource = await createTestDatabase();
    makeRepo = dataSource.getRepository(VehicleMake);
    typeRepo = dataSource.getRepository(VehicleType);
    service = new VehiclesService(makeRepo, typeRepo);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM vehicle_types;');
    await dataSource.query('DELETE FROM vehicle_makes;');

    const make1 = makeRepo.create({
      makeId: '440',
      makeName: 'ASTON MARTIN',
      vehicleTypes: [
        { typeId: '2', typeName: 'Passenger Car', makeId: '440' },
        {
          typeId: '7',
          typeName: 'Multipurpose Passenger Vehicle (MPV)',
          makeId: '440',
        },
      ],
    });

    const make2 = makeRepo.create({
      makeId: '441',
      makeName: 'TESLA',
      vehicleTypes: [{ typeId: '2', typeName: 'Passenger Car', makeId: '441' }],
    });

    await makeRepo.save([make1, make2]);
  });

  it('should retrieve all makes with pagination', async () => {
    const results = await service.getMakes({ limit: 10, offset: 0 });
    expect(results).toHaveLength(2);
    expect(results[0].makeName).toBe('ASTON MARTIN');
    expect(results[0].vehicleTypes).toHaveLength(2);
    expect(results[1].makeName).toBe('TESLA');
  });

  it('should search makes by name case-insensitively', async () => {
    const results = await service.getMakes({ search: 'aston' });
    expect(results).toHaveLength(1);
    expect(results[0].makeId).toBe('440');
  });

  it('should retrieve a single make by makeId', async () => {
    const make = await service.getMakeById('440');
    expect(make).toBeDefined();
    expect(make?.makeName).toBe('ASTON MARTIN');
    expect(make?.vehicleTypes).toHaveLength(2);
  });

  it('should return null if make is not found', async () => {
    const make = await service.getMakeById('non-existent');
    expect(make).toBeNull();
  });

  it('should retrieve vehicle types filtered by makeId', async () => {
    const types = await service.getVehicleTypes({ makeId: '440' });
    expect(types).toHaveLength(2);
  });

  it('should count total makes', async () => {
    const count = await service.countMakes();
    expect(count).toBe(2);
  });
});
