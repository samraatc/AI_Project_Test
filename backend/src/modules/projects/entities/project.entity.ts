import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Client } from '../../clients/entities/client.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column({ name: 'client_id', nullable: true }) clientId: string;
  @ManyToOne(() => Client, { nullable: true }) @JoinColumn({ name: 'client_id' }) client: Client;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @Column({ name: 'assigned_to', nullable: true }) assignedTo: string;
  @Column() name: string;
  @Column({ name: 'reference_number', nullable: true }) referenceNumber: string;
  @Column({ nullable: true, type: 'text' }) description: string;
  @Column({ nullable: true }) industry: string;
  @Column({ name: 'project_type', nullable: true }) projectType: string;
  @Column({ nullable: true }) location: string;
  @Column({ default: 'USD' }) currency: string;
  @Column({ default: 'draft' }) status: string;
  @Column({ name: 'start_date', nullable: true, type: 'date' }) startDate: Date;
  @Column({ name: 'end_date', nullable: true, type: 'date' }) endDate: Date;
  @Column({ nullable: true, type: 'date' }) deadline: Date;
  @Column({ name: 'ai_status', default: 'pending' }) aiStatus: string;
  @Column({ name: 'ai_processed_at', nullable: true }) aiProcessedAt: Date;
  @Column({ name: 'ai_confidence', nullable: true, type: 'decimal', precision: 5, scale: 2 }) aiConfidence: number;
  @Column({ name: 'ai_summary', nullable: true, type: 'text' }) aiSummary: string;
  @Column({ name: 'storage_path', nullable: true }) storagePath: string;
  @Column({ type: 'text', array: true, default: '{}' }) tags: string[];
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, any>;
  @Column({ name: 'cloned_from', nullable: true }) clonedFrom: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt: Date;
}
