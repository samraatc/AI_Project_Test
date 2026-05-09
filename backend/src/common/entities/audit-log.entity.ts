import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../modules/tenants/entities/tenant.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column({ name: 'user_id', nullable: true }) userId: string;
  @Column() action: string;
  @Column({ name: 'entity_type', nullable: true }) entityType: string;
  @Column({ name: 'entity_id', nullable: true }) entityId: string;
  @Column({ name: 'old_data', nullable: true, type: 'jsonb' }) oldData: any;
  @Column({ name: 'new_data', nullable: true, type: 'jsonb' }) newData: any;
  @Column({ name: 'ip_address', nullable: true }) ipAddress: string;
  @Column({ name: 'user_agent', nullable: true, type: 'text' }) userAgent: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
