import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('pricing_items')
export class PricingItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column() category: string;
  @Column({ nullable: true }) code: string;
  @Column() name: string;
  @Column() unit: string;
  @Column({ name: 'unit_rate', type: 'decimal', precision: 14, scale: 4 }) unitRate: number;
  @Column({ default: 'USD' }) currency: string;
  @Column({ nullable: true, type: 'text' }) description: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ name: 'valid_from', nullable: true, type: 'date' }) validFrom: Date;
  @Column({ name: 'valid_until', nullable: true, type: 'date' }) validUntil: Date;
  @Column({ nullable: true }) source: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, any>;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
