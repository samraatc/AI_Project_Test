import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { ApprovalStep } from './entities/approval-step.entity';
import { Estimation } from '../estimations/entities/estimation.entity';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalWorkflow) private wfRepo:   Repository<ApprovalWorkflow>,
    @InjectRepository(ApprovalStep)     private stepRepo: Repository<ApprovalStep>,
    @InjectRepository(Estimation)       private estRepo:  Repository<Estimation>,
    private events: EventEmitter2,
  ) {}

  async submit(estimationId: string, approverIds: string[], tenantId: string, userId: string) {
    const est = await this.estRepo.findOne({ where: { id: estimationId, tenantId } });
    if (!est) throw new NotFoundException('Estimation not found');
    if (est.isLocked) throw new BadRequestException('Already locked');
    if (!approverIds?.length) throw new BadRequestException('At least one approver required');
    const wf = await this.wfRepo.save(this.wfRepo.create({ tenantId, estimationId, submittedBy: userId, currentStep: 1, totalSteps: approverIds.length, status: 'pending', submittedAt: new Date() }));
    const steps = approverIds.map((aid, idx) => this.stepRepo.create({ workflowId: wf.id, approverId: aid, stepNumber: idx+1, status: idx===0?'pending':'waiting' }));
    await this.stepRepo.save(steps);
    await this.estRepo.update(estimationId, { status: 'under_review' });
    this.events.emit('approval.submitted', { workflow: wf, estimationId, tenantId });
    return wf;
  }

  async decide(workflowId: string, decision: 'approved'|'rejected', comments: string, userId: string, tenantId: string) {
    const wf = await this.wfRepo.findOne({ where: { id: workflowId, tenantId }, relations: ['steps'] });
    if (!wf) throw new NotFoundException('Workflow not found');
    if (wf.status !== 'pending') throw new BadRequestException('Already completed');
    const step = wf.steps.find(s => s.stepNumber === wf.currentStep && s.approverId === userId);
    if (!step) throw new ForbiddenException('You are not the current approver');
    await this.stepRepo.update(step.id, { status: decision, comments, decidedAt: new Date() });
    if (decision === 'rejected') {
      await this.wfRepo.update(workflowId, { status: 'rejected', completedAt: new Date() });
      await this.estRepo.update(wf.estimationId, { status: 'rejected' });
      this.events.emit('approval.rejected', { workflowId, tenantId, submittedBy: wf.submittedBy, comments });
    } else if (wf.currentStep >= wf.totalSteps) {
      await this.wfRepo.update(workflowId, { status: 'approved', completedAt: new Date() });
      await this.estRepo.update(wf.estimationId, { status: 'approved', isLocked: true, lockedAt: new Date(), lockedBy: userId });
      this.events.emit('approval.completed', { workflowId, tenantId, submittedBy: wf.submittedBy });
    } else {
      const next = wf.currentStep + 1;
      await this.wfRepo.update(workflowId, { currentStep: next });
      await this.stepRepo.update({ workflowId, stepNumber: next }, { status: 'pending' });
    }
    return this.getWorkflow(workflowId, tenantId);
  }

  async getWorkflow(id: string, tenantId: string) { return this.wfRepo.findOne({ where: { id, tenantId }, relations: ['steps','steps.approver'] }); }
  async getByEstimation(estimationId: string, tenantId: string) { return this.wfRepo.find({ where: { estimationId, tenantId }, relations: ['steps','steps.approver'], order: { createdAt: 'DESC' } }); }
  async myPending(userId: string) { return this.stepRepo.find({ where: { approverId: userId, status: 'pending' }, relations: ['workflow'] }); }
}
