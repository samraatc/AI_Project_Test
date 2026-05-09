import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAI } from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ProjectFile } from '../../files/entities/project-file.entity';
import { RagContext } from '../interfaces/rag-context.interface';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private openai: OpenAI;
  private qdrant: QdrantClient;

  constructor(private cfg: ConfigService, @InjectRepository(ProjectFile) private fileRepo: Repository<ProjectFile>) {
    this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') });
    this.qdrant = new QdrantClient({ host: cfg.get('ai.qdrantHost', 'localhost'), port: cfg.get('ai.qdrantPort', 6333) });
  }

  async embedAndStore(payload: { fileId: string; projectId: string; tenantId: string; text: string }): Promise<number> {
    const col = this.collectionName(payload.tenantId);
    await this.ensureCollection(col);
    const chunks = this.chunkText(payload.text, 1500, 200);
    let stored = 0;
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const emb = await this.openai.embeddings.create({ model: this.cfg.get('ai.embeddingModel', 'text-embedding-3-large'), input: batch });
      const points = emb.data.map((e, j) => ({ id: `${payload.fileId.replace(/-/g, '')}${i+j}`, vector: e.embedding, payload: { fileId: payload.fileId, projectId: payload.projectId, tenantId: payload.tenantId, chunkIdx: i+j, text: batch[j] } }));
      await this.qdrant.upsert(col, { points });
      stored += points.length;
    }
    await this.fileRepo.update(payload.fileId, { embedded: true, embeddedAt: new Date(), chunkCount: stored });
    return stored;
  }

  async retrieveContext(projectId: string, tenantId: string, projectType?: string): Promise<RagContext> {
    const col = this.collectionName(tenantId);
    try {
      const query = `${projectType || 'engineering'} project estimation materials costs`;
      const vec = await this.embed(query);
      const results = await this.qdrant.search(col, { vector: vec, limit: 8, filter: { must: [{ key: 'projectId', match: { value: projectId } }] } });
      const relevantChunks = results.map(r => ({ text: r.payload?.text as string, score: r.score, fileId: r.payload?.fileId as string, chunkIdx: r.payload?.chunkIdx as number }));
      return { relevantChunks, similarProjects: [], pricingItems: [] };
    } catch { return { relevantChunks: [], similarProjects: [], pricingItems: [] }; }
  }

  async deleteByProject(projectId: string, tenantId: string): Promise<void> {
    try { await this.qdrant.delete(this.collectionName(tenantId), { filter: { must: [{ key: 'projectId', match: { value: projectId } }] } }); } catch {}
  }

  private async embed(text: string): Promise<number[]> {
    const r = await this.openai.embeddings.create({ model: this.cfg.get('ai.embeddingModel', 'text-embedding-3-large'), input: text.substring(0, 8000) });
    return r.data[0].embedding;
  }

  private chunkText(text: string, size: number, overlap: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    const step = size - overlap;
    for (let i = 0; i < words.length; i += step) {
      const chunk = words.slice(i, i + size).join(' ');
      if (chunk.trim()) chunks.push(chunk);
    }
    return chunks;
  }

  private collectionName(tenantId: string): string { return `tenant_${tenantId.replace(/-/g,'_')}`; }

  private async ensureCollection(name: string): Promise<void> {
    try { await this.qdrant.getCollection(name); } catch {
      try { await this.qdrant.createCollection(name, { vectors: { size: 3072, distance: 'Cosine' } }); this.logger.log(`Created collection: ${name}`); } catch {}
    }
  }
}
