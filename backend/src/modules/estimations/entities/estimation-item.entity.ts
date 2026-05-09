import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Estimation } from './estimation.entity';

@Entity('estimation_items')
export class EstimationItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'estimation_id' }) estimationId: string;
  @ManyToOne(() => Estimation, (e: Estimation) => e.items, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'estimation_id' }) estimation: Estimation;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'pricing_item_id', nullable: true }) pricingItemId: string;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column() category: string;
  @Column({ nullable: true }) code: string;
  @Column() description: string;
  @Column({ nullable: true, type: 'text' }) specification: string;
  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 }) quantity: number;
  @Column() unit: string;
  @Column({ name: 'unit_rate', type: 'decimal', precision: 14, scale: 4, default: 0 }) unitRate: number;
  @Column({ name: 'discount_pct', type: 'decimal', precision: 6, scale: 2, default: 0 }) discountPct: number;
  @Column({ name: 'total_amount', type: 'decimal', precision: 16, scale: 2, default: 0 }) totalAmount: number;
  @Column({ default: 'USD' }) currency: string;
  @Column({ default: 'ai' }) source: string;
  @Column({ name: 'ai_confidence', nullable: true, type: 'decimal', precision: 5, scale: 2 }) aiConfidence: number;
  @Column({ name: 'is_flagged', default: false }) isFlagged: boolean;
  @Column({ name: 'flag_reason', nullable: true, type: 'text' }) flagReason: string;
  @Column({ nullable: true, type: 'text' }) notes: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
