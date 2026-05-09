import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApprovalWorkflow } from './approval-workflow.entity';
import { User } from '../../users/entities/user.entity';

@Entity('approval_steps')
export class ApprovalStep {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'workflow_id' }) workflowId: string;
  @ManyToOne(() => ApprovalWorkflow, (w: ApprovalWorkflow) => w.steps, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'workflow_id' }) workflow: ApprovalWorkflow;
  @Column({ name: 'approver_id' }) approverId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'approver_id' }) approver: User;
  @Column({ name: 'step_number' }) stepNumber: number;
  @Column({ default: 'pending' }) status: string;
  @Column({ nullable: true, type: 'text' }) comments: string;
  @Column({ name: 'decided_at', nullable: true }) decidedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
