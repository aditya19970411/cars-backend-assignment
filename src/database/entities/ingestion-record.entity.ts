import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

export enum IngestionStatus {
  IDLE = 'IDLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@ObjectType({
  description: 'Status and telemetry of a vehicle data ingestion run',
})
@Entity('ingestion_records')
export class IngestionRecord {
  @Field(() => ID)
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Field(() => String, {
    description: 'Ingestion status (IDLE, IN_PROGRESS, COMPLETED, FAILED)',
  })
  @Column({ type: 'varchar', length: 32, default: IngestionStatus.IDLE })
  status: IngestionStatus;

  @Field(() => Int, { description: 'Total number of makes to be processed' })
  @Column({ type: 'integer', default: 0 })
  totalMakes: number;

  @Field(() => Int, { description: 'Number of successfully processed makes' })
  @Column({ type: 'integer', default: 0 })
  processedMakes: number;

  @Field(() => Int, { description: 'Number of failed makes during ingestion' })
  @Column({ type: 'integer', default: 0 })
  failedMakes: number;

  @Field(() => Date, {
    nullable: true,
    description: 'Timestamp when ingestion started',
  })
  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Field(() => Date, {
    nullable: true,
    description: 'Timestamp when ingestion completed',
  })
  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Field(() => String, {
    nullable: true,
    description: 'Error message if ingestion failed',
  })
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  updatedAt: Date;
}
