import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAI } from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ProjectFile } from '../../files/entities/project-file.entity';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openai: OpenAI;
  private qdrant: QdrantClient;

  constructor(private cfg: ConfigService, @InjectRepository(ProjectFile) private fileRepo: Repository<ProjectFile>) {
    this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') });
    this.qdrant = new QdrantClient({ host: cfg.get('ai.qdrantHost', 'localhost'), port: cfg.get('ai.qdrantPort', 6333) });
  }

  async embedAndStore(payload: { fileId: string; projectId: string; tenantId: string; text: string }): Promise<number> {
    const col = `tenant_${payload.tenantId.replace(/-/g,'_')}`;
    try { await this.qdrant.getCollection(col); } catch { try { await this.qdrant.createCollection(col, { vectors: { size: 3072, distance: 'Cosine' } }); } catch {} }
    const words = payload.text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 1300) chunks.push(words.slice(i, i+1500).join(' '));
    let stored = 0;
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i+10).filter(Boolean);
      if (!batch.length) continue;
      const emb = await this.openai.embeddings.create({ model: 'text-embedding-3-large', input: batch });
      const points = emb.data.map((e, j) => ({ id: `${payload.fileId.replace(/-/g,'')}${i+j}`, vector: e.embedding, payload: { fileId: payload.fileId, projectId: payload.projectId, tenantId: payload.tenantId, chunkIdx: i+j, text: batch[j] } }));
      await this.qdrant.upsert(col, { points });
      stored += points.length;
    }
    await this.fileRepo.update(payload.fileId, { embedded: true, embeddedAt: new Date(), chunkCount: stored });
    this.logger.log(`Embedded ${stored} chunks for file ${payload.fileId}`);
    return stored;
  }

  async deleteByFile(fileId: string, tenantId: string): Promise<void> {
    try { await this.qdrant.delete(`tenant_${tenantId.replace(/-/g,'_')}`, { filter: { must: [{ key: 'fileId', match: { value: fileId } }] } }); } catch {}
  }
}
