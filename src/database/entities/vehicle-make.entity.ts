import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { VehicleType } from './vehicle-type.entity';

@ObjectType({
  description: 'Vehicle Make entity representing an automotive manufacturer',
})
@Entity('vehicle_makes')
export class VehicleMake {
  @Field(() => ID, { description: 'Unique identifier for the vehicle make' })
  @PrimaryColumn({ type: 'varchar', length: 64 })
  makeId: string;

  @Field(() => String, { description: 'Name of the vehicle make' })
  @Index('idx_make_name')
  @Column({ type: 'varchar', length: 255 })
  makeName: string;

  @Field(() => [VehicleType], {
    description: 'List of vehicle types produced by this make',
  })
  @OneToMany(() => VehicleType, (type) => type.make, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  vehicleTypes: VehicleType[];

  @Field(() => Date, { description: 'Record creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date, { description: 'Record last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;
}
