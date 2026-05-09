import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('project_files')
export class ProjectFile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'project_id' }) projectId: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'project_id' }) project: Project;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;
  @Column({ name: 'uploaded_by', nullable: true }) uploadedBy: string;
  @Column({ name: 'original_name' }) originalName: string;
  @Column({ name: 'storage_key' }) storageKey: string;
  @Column({ name: 'mime_type', nullable: true }) mimeType: string;
  @Column({ name: 'size_bytes', nullable: true, type: 'bigint' }) sizeBytes: number;
  @Column({ name: 'file_type', nullable: true }) fileType: string;
  @Column({ name: 'ocr_status', default: 'pending' }) ocrStatus: string;
  @Column({ name: 'ocr_text', nullable: true, type: 'text' }) ocrText: string;
  @Column({ name: 'parse_status', default: 'pending' }) parseStatus: string;
  @Column({ name: 'parsed_data', nullable: true, type: 'jsonb' }) parsedData: any;
  @Column({ default: false }) embedded: boolean;
  @Column({ name: 'embedded_at', nullable: true }) embeddedAt: Date;
  @Column({ name: 'chunk_count', default: 0 }) chunkCount: number;
  @Column({ default: 1 }) version: number;
  @Column({ name: 'parent_file_id', nullable: true }) parentFileId: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
