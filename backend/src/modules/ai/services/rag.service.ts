import { Injectable, Logger }  from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import { InjectRepository }    from '@nestjs/typeorm';
import { Repository }          from 'typeorm';
import { OpenAI }              from 'openai';
import { QdrantClient }        from '@qdrant/js-client-rest';
import { ProjectFile }         from '../../files/entities/project-file.entity';
import { RagContext }          from '../interfaces/rag-context.interface';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private openai:  OpenAI;
  private qdrant:  QdrantClient;

  constructor(
    private cfg: ConfigService,
    @InjectRepository(ProjectFile) private fileRepo: Repository<ProjectFile>,
  ) {
    this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') });
    this.qdrant = new QdrantClient({
      host: cfg.get('ai.qdrantHost', 'localhost'),
      port: cfg.get('ai.qdrantPort', 6333),
    });
  }

  async retrieveContext(
    projectId: string,
    tenantId:  string,
    _projectType?: string,
  ): Promise<RagContext> {
    const col = `tenant_${tenantId.replace(/-/g, '_')}`;
    try {
      const query = `engineering project estimation materials quantities costs`;
      const vec   = await this.embed(query);
      const results = await this.qdrant.search(col, {
        vector: vec,
        limit:  8,
        filter: { must: [{ key: 'projectId', match: { value: projectId } }] },
      });
      const relevantChunks = results.map(r => ({
        text:     (r.payload?.text || '') as string,
        score:    r.score,
        fileId:   (r.payload?.fileId  || '') as string,
        chunkIdx: (r.payload?.chunkIdx || 0) as number,
      }));
      return { relevantChunks, similarProjects: [], pricingItems: [] };
    } catch (err: any) {
      this.logger.warn(`RAG retrieval skipped: ${err.message}`);
      return { relevantChunks: [], similarProjects: [], pricingItems: [] };
    }
  }

  private async embed(text: string): Promise<number[]> {
    const r = await this.openai.embeddings.create({
      model: this.cfg.get('ai.embeddingModel', 'text-embedding-3-large'),
      input: text.substring(0, 8000),
    });
    return r.data[0].embedding;
  }

  async deleteByProject(projectId: string, tenantId: string): Promise<void> {
    try {
      await this.qdrant.delete(`tenant_${tenantId.replace(/-/g, '_')}`, {
        filter: { must: [{ key: 'projectId', match: { value: projectId } }] },
      });
    } catch {}
  }
}
