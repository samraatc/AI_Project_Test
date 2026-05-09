import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Estimation } from '../../estimations/entities/estimation.entity';
import { Project } from '../../projects/entities/project.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('quotations')
export class Quotation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'estimation_id' }) estimationId: string;
  @ManyToOne(() => Estimation) @JoinColumn({ name: 'estimation_id' }) estimation: Estimation;
  @Column({ name: 'project_id' }) projectId: string;
  @ManyToOne(() => Project) @JoinColumn({ name: 'project_id' }) project: Project;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @Column({ name: 'quote_number', unique: true }) quoteNumber: string;
  @Column() title: string;
  @Column({ default: 'draft' }) status: string;
  @Column({ name: 'scope_summary', nullable: true, type: 'text' }) scopeSummary: string;
  @Column({ name: 'terms_conditions', nullable: true, type: 'text' }) termsConditions: string;
  @Column({ name: 'validity_days', default: 30 }) validityDays: number;
  @Column({ name: 'valid_until', nullable: true, type: 'date' }) validUntil: Date;
  @Column({ type: 'decimal', precision: 16, scale: 2 }) subtotal: number;
  @Column({ name: 'tax_amount', type: 'decimal', precision: 16, scale: 2 }) taxAmount: number;
  @Column({ name: 'final_total', type: 'decimal', precision: 16, scale: 2 }) finalTotal: number;
  @Column({ default: 'USD' }) currency: string;
  @Column({ name: 'pdf_storage_key', nullable: true }) pdfStorageKey: string;
  @Column({ name: 'sent_at', nullable: true }) sentAt: Date;
  @Column({ name: 'sent_to_email', nullable: true }) sentToEmail: string;
  @Column({ name: 'signed_at', nullable: true }) signedAt: Date;
  @Column({ name: 'ai_generated', default: true }) aiGenerated: boolean;
  @Column({ name: 'template_id', nullable: true }) templateId: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
