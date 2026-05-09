import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { EstimationItem } from './estimation-item.entity';

@Entity('estimations')
export class Estimation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'project_id' }) projectId: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'project_id' }) project: Project;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @Column({ name: 'locked_by', nullable: true }) lockedBy: string;
  @Column({ default: 'Estimation v1' }) title: string;
  @Column({ name: 'version_number', default: 1 }) versionNumber: number;
  @Column({ default: 'draft' }) status: string;
  @Column({ name: 'material_cost', type: 'decimal', precision: 16, scale: 2, default: 0 }) materialCost: number;
  @Column({ name: 'steel_cost', type: 'decimal', precision: 16, scale: 2, default: 0 }) steelCost: number;
  @Column({ name: 'labor_cost', type: 'decimal', precision: 16, scale: 2, default: 0 }) laborCost: number;
  @Column({ name: 'equipment_cost', type: 'decimal', precision: 16, scale: 2, default: 0 }) equipmentCost: number;
  @Column({ name: 'transport_cost', type: 'decimal', precision: 16, scale: 2, default: 0 }) transportCost: number;
  @Column({ name: 'overhead_cost', type: 'decimal', precision: 16, scale: 2, default: 0 }) overheadCost: number;
  @Column({ name: 'overhead_pct', type: 'decimal', precision: 6, scale: 2, default: 8 }) overheadPct: number;
  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 }) subtotal: number;
  @Column({ name: 'tax_amount', type: 'decimal', precision: 16, scale: 2, default: 0 }) taxAmount: number;
  @Column({ name: 'tax_pct', type: 'decimal', precision: 6, scale: 2, default: 5 }) taxPct: number;
  @Column({ name: 'profit_margin_pct', type: 'decimal', precision: 6, scale: 2, default: 15 }) profitMarginPct: number;
  @Column({ name: 'profit_amount', type: 'decimal', precision: 16, scale: 2, default: 0 }) profitAmount: number;
  @Column({ name: 'final_total', type: 'decimal', precision: 16, scale: 2, default: 0 }) finalTotal: number;
  @Column({ default: 'USD' }) currency: string;
  @Column({ name: 'ai_confidence', nullable: true, type: 'decimal', precision: 5, scale: 2 }) aiConfidence: number;
  @Column({ name: 'ai_model_used', nullable: true }) aiModelUsed: string;
  @Column({ name: 'ai_prompt_tokens', nullable: true, default: 0 }) aiPromptTokens: number;
  @Column({ name: 'ai_output_tokens', nullable: true, default: 0 }) aiOutputTokens: number;
  @Column({ name: 'ai_raw_response', nullable: true, type: 'jsonb' }) aiRawResponse: any;
  @Column({ name: 'ai_risk_analysis', type: 'jsonb', default: '[]' }) aiRiskAnalysis: any[];
  @Column({ name: 'ai_missing_items', type: 'jsonb', default: '[]' }) aiMissingItems: any[];
  @Column({ name: 'ai_recommendations', type: 'jsonb', default: '[]' }) aiRecommendations: any[];
  @Column({ nullable: true, type: 'text' }) notes: string;
  @Column({ name: 'is_locked', default: false }) isLocked: boolean;
  @Column({ name: 'locked_at', nullable: true }) lockedAt: Date;
  @Column({ name: 'parent_id', nullable: true }) parentId: string;
  @OneToMany(() => EstimationItem, (item: EstimationItem) => item.estimation, { cascade: true })
  items: EstimationItem[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
