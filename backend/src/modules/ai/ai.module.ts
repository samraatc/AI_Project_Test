import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiOrchestrationService } from './services/ai-orchestration.service';
import { DocumentAgentService } from './agents/document-agent.service';
import { EstimationAgentService } from './agents/estimation-agent.service';
import { CostOptimAgent } from './agents/cost-optim-agent.service';
import { QuotationAgentService } from './agents/quotation-agent.service';
import { AnalyticsAgentService } from './agents/analytics-agent.service';
import { RagService } from './services/rag.service';
import { EmbeddingService } from './services/embedding.service';
import { PromptEngineService } from './services/prompt-engine.service';
import { AiJobProcessor } from './processors/ai-job.processor';
import { DocumentJobProcessor } from './processors/document-job.processor';
import { Project } from '../projects/entities/project.entity';
import { ProjectFile } from '../files/entities/project-file.entity';
import { Estimation } from '../estimations/entities/estimation.entity';
import { EstimationItem } from '../estimations/entities/estimation-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectFile, Estimation, EstimationItem]),
    BullModule.registerQueue({ name: 'ai-document-processing' }, { name: 'ai-estimation' }),
  ],
  controllers: [AiController],
  providers: [AiOrchestrationService, DocumentAgentService, EstimationAgentService, CostOptimAgent, QuotationAgentService, AnalyticsAgentService, RagService, EmbeddingService, PromptEngineService, AiJobProcessor, DocumentJobProcessor],
  exports: [AiOrchestrationService, RagService, EmbeddingService, DocumentAgentService, QuotationAgentService, PromptEngineService],
})
export class AiModule {}
