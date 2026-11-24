import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { VehicleMake } from '../database/entities/vehicle-make.entity';
import { VehicleType } from '../database/entities/vehicle-type.entity';
import {
  GetMakesArgs,
  GetVehicleTypesArgs,
} from '../graphql/dto/get-makes.args';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleMake)
    private readonly makeRepository: Repository<VehicleMake>,
    @InjectRepository(VehicleType)
    private readonly vehicleTypeRepository: Repository<VehicleType>,
  ) {}

  /**
   * Retrieves vehicle makes with pagination, search, and relations
   */
  async getMakes(args: GetMakesArgs): Promise<VehicleMake[]> {
    const { limit = 50, offset = 0, search } = args;

    const queryBuilder = this.makeRepository
      .createQueryBuilder('make')
      .leftJoinAndSelect('make.vehicleTypes', 'type')
      .take(limit)
      .skip(offset)
      .orderBy('make.makeName', 'ASC');

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.where(
        'make.makeName ILIKE :search OR make.makeId ILIKE :search',
        { search: searchTerm },
      );
    }

    return queryBuilder.getMany();
  }

  /**
   * Retrieves a single make by makeId
   */
  async getMakeById(makeId: string): Promise<VehicleMake | null> {
    return this.makeRepository.findOne({
      where: { makeId },
      relations: { vehicleTypes: true },
    });
  }

  /**
   * Retrieves vehicle types optionally filtered by makeId or search query
   */
  async getVehicleTypes(args: GetVehicleTypesArgs): Promise<VehicleType[]> {
    const { makeId, typeId, search, limit = 100 } = args;

    const where: Record<string, unknown> = {};
    if (makeId) {
      where.makeId = makeId;
    }
    if (typeId) {
      where.typeId = typeId;
    }
    if (search && search.trim()) {
      where.typeName = Like(`%${search.trim()}%`);
    }

    return this.vehicleTypeRepository.find({
      where,
      take: limit,
      order: { typeName: 'ASC' },
    });
  }

  /**
   * Counts total vehicle makes in the datastore
   */
  async countMakes(): Promise<number> {
    return this.makeRepository.count();
  }
}
