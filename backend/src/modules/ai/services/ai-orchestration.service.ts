import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DocumentAgentService } from '../agents/document-agent.service';
import { EstimationAgentService } from '../agents/estimation-agent.service';
import { CostOptimAgent } from '../agents/cost-optim-agent.service';
import { RagService } from './rag.service';
import { EmbeddingService } from './embedding.service';
import { Project } from '../../projects/entities/project.entity';
import { ProjectFile } from '../../files/entities/project-file.entity';
import { Estimation } from '../../estimations/entities/estimation.entity';
import { EstimationItem } from '../../estimations/entities/estimation-item.entity';
import { AiEstimationResult } from '../interfaces/ai-estimation-result.interface';

@Injectable()
export class AiOrchestrationService {
  private readonly logger = new Logger(AiOrchestrationService.name);

  constructor(
    @InjectRepository(Project)        private projectRepo:    Repository<Project>,
    @InjectRepository(ProjectFile)    private fileRepo:       Repository<ProjectFile>,
    @InjectRepository(Estimation)     private estimationRepo: Repository<Estimation>,
    @InjectRepository(EstimationItem) private itemRepo:       Repository<EstimationItem>,
    @InjectQueue('ai-estimation')     private estQueue:       Queue,
    private docAgent:   DocumentAgentService,
    private estAgent:   EstimationAgentService,
    private optAgent:   CostOptimAgent,
    private ragSvc:     RagService,
    private embSvc:     EmbeddingService,
    private events:     EventEmitter2,
  ) {}

  async runFullPipeline(projectId: string, tenantId: string, userId: string) {
    await this.projectRepo.update(projectId, { aiStatus: 'processing' });
    const job = await this.estQueue.add('full-pipeline', { projectId, tenantId, userId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 50 });
    return { jobId: String(job.id), message: 'AI analysis started.' };
  }

  async executePipeline(projectId: string, tenantId: string, userId: string): Promise<void> {
    this.logger.log(`Pipeline start: ${projectId}`);
    try {
      const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId } });
      if (!project) throw new Error(`Project ${projectId} not found`);
      const files = await this.fileRepo.find({ where: { projectId, tenantId } });
      if (!files.length) throw new Error('No files to process');

      this.logger.log('Step 1: Document processing');
      const docCtx = await this.docAgent.processFiles(files, project);

      this.logger.log('Step 2: Embedding');
      for (const f of files) {
        if (!f.embedded && f.ocrText) await this.embSvc.embedAndStore({ fileId: f.id, projectId: f.projectId, tenantId: f.tenantId, text: f.ocrText });
      }

      this.logger.log('Step 3: RAG retrieval');
      const ragCtx = await this.ragSvc.retrieveContext(projectId, tenantId, docCtx.projectType);

      this.logger.log('Step 4: AI estimation');
      const result = await this.estAgent.generateEstimation(project, docCtx, ragCtx);

      this.logger.log('Step 5: Cost optimisation');
      const opts = await this.optAgent.analyze(result, tenantId);

      this.logger.log('Step 6: Persist');
      await this.persist(projectId, tenantId, userId, result, opts);

      await this.projectRepo.update(projectId, { aiStatus: 'completed', aiProcessedAt: new Date(), aiConfidence: result.confidence, aiSummary: result.projectSummary });
      this.events.emit('ai.pipeline.completed', { projectName: project.name, userId, confidence: result.confidence });
      this.logger.log(`Pipeline complete: ${projectId}`);
    } catch (err: any) {
      this.logger.error(`Pipeline failed ${projectId}: ${err.message}`);
      await this.projectRepo.update(projectId, { aiStatus: 'failed' });
      throw err;
    }
  }

  private async persist(projectId: string, tenantId: string, userId: string, r: AiEstimationResult, opts: any): Promise<Estimation> {
    const matCost = this.sum(r, ['material']); const steelCost = this.sum(r, ['steel']);
    const labCost = this.sum(r, ['labor']);    const eqCost   = this.sum(r, ['equipment']);
    const trCost  = this.sum(r, ['transport']); const base = matCost + steelCost + labCost + eqCost + trCost;
    const ovhPct = 8; const taxPct = 5; const profPct = 15;
    const ovh = base * ovhPct/100; const sub = base + ovh; const tax = sub * taxPct/100; const prof = sub * profPct/100; const total = sub + tax + prof;

    const est = await this.estimationRepo.save(this.estimationRepo.create({
      projectId, tenantId, createdBy: userId, title: `AI Estimation — ${r.projectName}`, versionNumber: 1, status: 'draft',
      materialCost: matCost, steelCost, laborCost: labCost, equipmentCost: eqCost, transportCost: trCost,
      overheadCost: ovh, overheadPct: ovhPct, subtotal: sub, taxAmount: tax, taxPct, profitMarginPct: profPct, profitAmount: prof, finalTotal: total,
      aiConfidence: r.confidence, aiModelUsed: r.modelUsed, aiPromptTokens: r.promptTokens, aiOutputTokens: r.outputTokens, aiRawResponse: r.rawResponse,
      aiRiskAnalysis: r.riskAnalysis, aiMissingItems: r.missingItems, aiRecommendations: [...r.recommendations, ...(opts.suggestions||[])],
    }));

    if (r.items?.length) {
      const items = r.items.map(item => this.itemRepo.create({ estimationId: est.id, tenantId, sortOrder: item.sortOrder, category: item.category, code: item.code, description: item.description, specification: item.specification, quantity: item.quantity, unit: item.unit, unitRate: item.unitRate, discountPct: item.discountPct||0, totalAmount: item.quantity * item.unitRate * (1-(item.discountPct||0)/100), source: 'ai', aiConfidence: item.aiConfidence, isFlagged: item.isFlagged, flagReason: item.flagReason }));
      await this.itemRepo.save(items);
    }
    return est;
  }

  private sum(r: AiEstimationResult, cats: string[]): number {
    return (r.items||[]).filter(i => cats.includes(i.category)).reduce((s,i) => s + i.quantity * i.unitRate * (1-(i.discountPct||0)/100), 0);
  }

  async reAnalyze(projectId: string, tenantId: string, userId: string) { return this.runFullPipeline(projectId, tenantId, userId); }

  async getPipelineStatus(projectId: string, tenantId: string) {
    return this.projectRepo.findOne({ where: { id: projectId, tenantId }, select: ['id', 'aiStatus', 'aiProcessedAt', 'aiConfidence', 'aiSummary'] });
  }
}
