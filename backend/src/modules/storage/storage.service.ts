import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;

  constructor(private cfg: ConfigService) {
    this.client = new Minio.Client({ endPoint: cfg.get('storage.endpoint', 'localhost'), port: cfg.get('storage.port', 9000), useSSL: cfg.get('storage.useSsl', false), accessKey: cfg.get('storage.accessKey'), secretKey: cfg.get('storage.secretKey') });
  }

  async onModuleInit() { this.logger.log('Storage service initialized'); }

  async uploadBuffer(key: string, buffer: Buffer, contentType = 'application/octet-stream', bucket = 'platform-system'): Promise<string> {
    await this.ensureBucket(bucket);
    await this.client.putObject(bucket, key, buffer, buffer.length, { 'Content-Type': contentType });
    return key;
  }

  async uploadStream(key: string, stream: Readable, size: number, contentType = 'application/octet-stream', bucket = 'platform-system'): Promise<string> {
    await this.ensureBucket(bucket);
    await this.client.putObject(bucket, key, stream, size, { 'Content-Type': contentType });
    return key;
  }

  async downloadFile(key: string, bucket = 'platform-system'): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, key);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      (stream as any).on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      (stream as any).on('error', reject);
      (stream as any).on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async getPresignedUrl(key: string, expiry = 3600, bucket = 'platform-system'): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expiry);
  }

  async deleteFile(key: string, bucket = 'platform-system'): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  async exists(key: string, bucket = 'platform-system'): Promise<boolean> {
    try { await this.client.statObject(bucket, key); return true; } catch { return false; }
  }

  buildFileKey(tenantId: string, projectId: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `tenants/${tenantId}/projects/${projectId}/files/${Date.now()}_${safe}`;
  }

  buildQuotationKey(tenantId: string, quotationId: string): string {
    return `tenants/${tenantId}/quotations/${quotationId}/quotation.pdf`;
  }

  async ensureBucket(bucket: string): Promise<void> {
    try { await this.client.bucketExists(bucket) || await this.client.makeBucket(bucket); } catch { await this.client.makeBucket(bucket); }
  }
}
