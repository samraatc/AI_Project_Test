import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AiOrchestrationService } from '../services/ai-orchestration.service';

@Processor('ai-estimation')
export class AiJobProcessor {
  private readonly logger = new Logger(AiJobProcessor.name);
  constructor(private orchestration: AiOrchestrationService) {}

  @Process('full-pipeline')
  async handleFullPipeline(job: Job<{ projectId: string; tenantId: string; userId: string }>) {
    this.logger.log(`Job ${job.id} — project ${job.data.projectId}`);
    try {
      await this.orchestration.executePipeline(job.data.projectId, job.data.tenantId, job.data.userId);
      await job.progress(100);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Job ${job.id} failed: ${err.message}`, err.stack);
      throw err;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) { this.logger.error(`Queue job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`); }

  @OnQueueCompleted()
  onCompleted(job: Job) { this.logger.log(`Queue job ${job.id} completed`); }
}
