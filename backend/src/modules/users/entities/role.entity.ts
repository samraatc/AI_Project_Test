import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column() name: string;
  @Column({ name: 'is_system', default: false }) isSystem: boolean;
  @Column({ type: 'jsonb', default: '[]' }) permissions: string[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
