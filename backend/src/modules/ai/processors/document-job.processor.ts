import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { ProjectFile } from '../../files/entities/project-file.entity';
import { DocumentAgentService } from '../agents/document-agent.service';
import { EmbeddingService } from '../services/embedding.service';

@Processor('ai-document-processing')
export class DocumentJobProcessor {
  private readonly logger = new Logger(DocumentJobProcessor.name);

  constructor(
    @InjectRepository(ProjectFile) private fileRepo: Repository<ProjectFile>,
    private docAgent: DocumentAgentService,
    private embedding: EmbeddingService,
  ) {}

  @Process('process-file')
  async handleProcessFile(job: Job<{ fileId: string; projectId: string; tenantId: string }>) {
    const { fileId, projectId, tenantId } = job.data;
    this.logger.log(`Processing file ${fileId}`);
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) return;
    try {
      await this.fileRepo.update(fileId, { ocrStatus: 'processing' });
      const text = await this.docAgent.extractText(file);
      await this.fileRepo.update(fileId, { ocrText: text, ocrStatus: 'done', parseStatus: 'done' });
      if (text?.trim()) {
        await this.embedding.embedAndStore({ fileId, projectId, tenantId, text });
      }
      this.logger.log(`File ${fileId} processed`);
    } catch (err: any) {
      this.logger.error(`File ${fileId} failed: ${err.message}`);
      await this.fileRepo.update(fileId, { ocrStatus: 'failed' });
      throw err;
    }
  }
}
