import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column() name: string;
  @Column({ nullable: true }) company: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true, type: 'text' }) address: string;
  @Column({ nullable: true }) country: string;
  @Column({ default: 'USD' }) currency: string;
  @Column({ name: 'tax_number', nullable: true }) taxNumber: string;
  @Column({ nullable: true, type: 'text' }) notes: string;
  @Column({ default: 'active' }) status: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, any>;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
