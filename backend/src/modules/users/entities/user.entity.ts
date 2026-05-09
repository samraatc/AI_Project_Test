import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column({ name: 'role_id' }) roleId: string;
  @ManyToOne(() => Role) @JoinColumn({ name: 'role_id' }) role: Role;
  @Column() email: string;
  @Column({ name: 'password_hash' }) passwordHash: string;
  @Column({ name: 'first_name', nullable: true }) firstName: string;
  @Column({ name: 'last_name', nullable: true }) lastName: string;
  @Column({ name: 'avatar_url', nullable: true }) avatarUrl: string;
  @Column({ nullable: true }) department: string;
  @Column({ default: 'active' }) status: string;
  @Column({ name: 'last_login_at', nullable: true }) lastLoginAt: Date;
  @Column({ name: 'mfa_enabled', default: false }) mfaEnabled: boolean;
  @Column({ name: 'mfa_secret', nullable: true }) mfaSecret: string;
  @Column({ name: 'invite_token', nullable: true }) inviteToken: string;
  @Column({ name: 'invite_expires', nullable: true }) inviteExpires: Date;
  @Column({ type: 'jsonb', default: '{}' }) settings: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
