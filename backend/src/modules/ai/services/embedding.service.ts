import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import { OpenAI }             from 'openai';
import { QdrantClient }       from '@qdrant/js-client-rest';
import { ProjectFile }        from '../../files/entities/project-file.entity';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openai:  OpenAI;
  private qdrant:  QdrantClient;
  private collectionDims = new Map<string, number>(); // cache created collections

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

  async embedAndStore(payload: {
    fileId:    string;
    projectId: string;
    tenantId:  string;
    text:      string;
  }): Promise<number> {
    if (!payload.text?.trim()) {
      this.logger.warn(`No text to embed for file ${payload.fileId}`);
      return 0;
    }

    const col = this.collectionName(payload.tenantId);

    try {
      // Step 1: chunk the text
      const chunks = this.chunkText(payload.text, 1500, 200);
      if (!chunks.length) return 0;

      // Step 2: generate ONE test embedding to get actual dimension
      this.logger.log(`Generating embeddings for ${chunks.length} chunks`);
      const testEmb = await this.openai.embeddings.create({
        model: this.cfg.get('ai.embeddingModel', 'text-embedding-3-large'),
        input: chunks[0].substring(0, 8000),
      });
      const actualDim = testEmb.data[0].embedding.length;
      this.logger.log(`Embedding dimension: ${actualDim}`);

      // Step 3: ensure collection exists with CORRECT dimension
      await this.ensureCollection(col, actualDim);

      // Step 4: embed remaining chunks and upsert
      const allEmbeddings: { embedding: number[]; chunk: string }[] = [
        { embedding: testEmb.data[0].embedding, chunk: chunks[0] },
      ];

      for (let i = 1; i < chunks.length; i += 10) {
        const batch = chunks.slice(i, i + 10).filter(Boolean);
        if (!batch.length) continue;
        const emb = await this.openai.embeddings.create({
          model: this.cfg.get('ai.embeddingModel', 'text-embedding-3-large'),
          input: batch.map(c => c.substring(0, 8000)),
        });
        for (let j = 0; j < emb.data.length; j++) {
          allEmbeddings.push({ embedding: emb.data[j].embedding, chunk: batch[j] });
        }
      }

      // Step 5: build points with numeric IDs
      const points = allEmbeddings.map((e, idx) => ({
        id:      this.makeNumericId(payload.fileId, idx),
        vector:  e.embedding,
        payload: {
          fileId:    payload.fileId,
          projectId: payload.projectId,
          tenantId:  payload.tenantId,
          chunkIdx:  idx,
          text:      e.chunk.substring(0, 500),
        },
      }));

      // Step 6: upsert in batches of 50
      for (let i = 0; i < points.length; i += 50) {
        await this.qdrant.upsert(col, { points: points.slice(i, i + 50) });
      }

      // Step 7: update file record
      await this.fileRepo.update(payload.fileId, {
        embedded:   true,
        embeddedAt: new Date(),
        chunkCount: points.length,
      });

      this.logger.log(`Stored ${points.length} vectors for file ${payload.fileId}`);
      return points.length;

    } catch (err: any) {
      this.logger.error(`Embedding failed for file ${payload.fileId}: ${err.message}`);
      // Don't throw — embedding is optional, estimation can still proceed
      return 0;
    }
  }

  async deleteByFile(fileId: string, tenantId: string): Promise<void> {
    try {
      await this.qdrant.delete(this.collectionName(tenantId), {
        filter: { must: [{ key: 'fileId', match: { value: fileId } }] },
      });
    } catch {}
  }

  private async ensureCollection(name: string, dim: number): Promise<void> {
    // Use cache to avoid repeated API calls
    if (this.collectionDims.get(name) === dim) return;

    try {
      const info = await this.qdrant.getCollection(name);
      const existingDim = (info as any)?.config?.params?.vectors?.size as number | undefined;

      if (existingDim && existingDim !== dim) {
        // Wrong dimension — delete and recreate
        this.logger.warn(
          `Collection ${name} has dim=${existingDim}, need dim=${dim}. Recreating...`
        );
        await this.qdrant.deleteCollection(name);
        await this.createCollection(name, dim);
      } else if (!existingDim) {
        // Collection exists but can't read dim — recreate
        await this.qdrant.deleteCollection(name);
        await this.createCollection(name, dim);
      } else {
        this.logger.log(`Collection ${name} OK (dim=${existingDim})`);
      }
    } catch {
      // Collection doesn't exist — create it
      await this.createCollection(name, dim);
    }

    this.collectionDims.set(name, dim);
  }

  private async createCollection(name: string, dim: number): Promise<void> {
    await this.qdrant.createCollection(name, {
      vectors: { size: dim, distance: 'Cosine' },
    });
    this.logger.log(`Created collection: ${name} (dim=${dim})`);
  }

  private collectionName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '_')}`;
  }

  // Convert fileId (UUID) + index → stable numeric ID for Qdrant
  private makeNumericId(fileId: string, idx: number): number {
    // Use last 8 hex chars of UUID as base + idx offset
    const hex  = fileId.replace(/-/g, '').slice(-8);
    const base = parseInt(hex, 16) % 100000000;
    return base * 1000 + idx;
  }

  private chunkText(text: string, size: number, overlap: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const chunks: string[] = [];
    const step = Math.max(1, size - overlap);
    for (let i = 0; i < words.length; i += step) {
      const chunk = words.slice(i, i + size).join(' ');
      if (chunk.trim()) chunks.push(chunk);
    }
    return chunks;
  }
}
