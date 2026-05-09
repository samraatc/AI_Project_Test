import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Estimation } from '../../estimations/entities/estimation.entity';
import { ApprovalStep } from './approval-step.entity';

@Entity('approval_workflows')
export class ApprovalWorkflow {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'estimation_id' }) estimationId: string;
  @ManyToOne(() => Estimation) @JoinColumn({ name: 'estimation_id' }) estimation: Estimation;
  @Column({ name: 'submitted_by', nullable: true }) submittedBy: string;
  @Column({ name: 'current_step', default: 1 }) currentStep: number;
  @Column({ name: 'total_steps', default: 1 }) totalSteps: number;
  @Column({ default: 'pending' }) status: string;
  @Column({ name: 'submitted_at', nullable: true }) submittedAt: Date;
  @Column({ name: 'completed_at', nullable: true }) completedAt: Date;
  @OneToMany(() => ApprovalStep, (s: ApprovalStep) => s.workflow, { cascade: true }) steps: ApprovalStep[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
