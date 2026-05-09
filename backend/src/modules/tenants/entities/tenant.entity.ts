import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ unique: true }) slug: string;
  @Column({ default: 'starter' }) plan: string;
  @Column({ default: 'active' }) status: string;
  @Column({ name: 'schema_name', unique: true }) schemaName: string;
  @Column({ name: 'storage_bucket', unique: true }) storageBucket: string;
  @Column({ name: 'max_users', default: 10 }) maxUsers: number;
  @Column({ name: 'max_storage_gb', default: 50 }) maxStorageGb: number;
  @Column({ name: 'ai_model', default: 'gpt-4o' }) aiModel: string;
  @Column({ name: 'ai_tokens_used', type: 'bigint', default: 0 }) aiTokensUsed: number;
  @Column({ name: 'ai_token_limit', type: 'bigint', default: 5000000 }) aiTokenLimit: number;
  @Column({ type: 'jsonb', default: '{}' }) settings: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
