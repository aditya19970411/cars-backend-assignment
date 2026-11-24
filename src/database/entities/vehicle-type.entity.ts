import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, HideField } from '@nestjs/graphql';
import type { VehicleMake } from './vehicle-make.entity';

@ObjectType({
  description:
    'Vehicle Type entity representing a classification of vehicle (e.g., Passenger Car, Truck)',
})
@Entity('vehicle_types')
@Index('idx_make_type_unique', ['makeId', 'typeId'], { unique: true })
export class VehicleType {
  @HideField()
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Field(() => ID, { description: 'Unique identifier for the vehicle type' })
  @Index('idx_type_id')
  @Column({ type: 'varchar', length: 64 })
  typeId: string;

  @Field(() => String, { description: 'Name of the vehicle type' })
  @Index('idx_type_name')
  @Column({ type: 'varchar', length: 255 })
  typeName: string;

  @Field(() => String, { description: 'Associated Make ID' })
  @Index('idx_type_make_id')
  @Column({ type: 'varchar', length: 64 })
  makeId: string;

  @ManyToOne('VehicleMake', (make: VehicleMake) => make.vehicleTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'makeId', referencedColumnName: 'makeId' })
  make?: VehicleMake;

  @Field(() => Date, { description: 'Record creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date, { description: 'Record last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;
}
