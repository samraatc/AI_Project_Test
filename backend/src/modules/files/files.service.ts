import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { ProjectFile } from './entities/project-file.entity';
import { Project } from '../projects/entities/project.entity';
import { StorageService } from '../storage/storage.service';
import { DocumentAgentService } from '../ai/agents/document-agent.service';

const ALLOWED_MIME = new Set(['application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/tiff','text/csv','application/zip','application/x-zip-compressed']);

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(ProjectFile) private fileRepo:    Repository<ProjectFile>,
    @InjectRepository(Project)     private projectRepo: Repository<Project>,
    @InjectQueue('ai-document-processing') private docQueue: Queue,
    private storage: StorageService,
  ) {}

  async uploadFiles(projectId: string, tenantId: string, userId: string, files: any[]): Promise<ProjectFile[]> {
    const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');
    const saved: ProjectFile[] = [];
    for (const file of files) {
      const mimeOk = ALLOWED_MIME.has(file.mimetype) || file.mimetype?.startsWith('image/') || file.mimetype?.startsWith('text/');
      if (!mimeOk) throw new BadRequestException(`File type not allowed: ${file.mimetype}`);
      const fileType = DocumentAgentService.detectFileType(file.mimetype, file.originalname);
      const storageKey = this.storage.buildFileKey(tenantId, projectId, file.originalname);
      await this.storage.uploadBuffer(storageKey, file.buffer, file.mimetype);
      const record = await this.fileRepo.save(this.fileRepo.create({ projectId, tenantId, uploadedBy: userId, originalName: file.originalname, storageKey, mimeType: file.mimetype, sizeBytes: file.size, fileType, ocrStatus: 'pending', parseStatus: 'pending' }));
      saved.push(record);
      await this.docQueue.add('process-file', { fileId: record.id, projectId, tenantId }, { attempts: 3, backoff: { type: 'exponential', delay: 3000 } });
      this.logger.log(`Uploaded: ${file.originalname}`);
    }
    return saved;
  }

  async findByProject(projectId: string, tenantId: string) { return this.fileRepo.find({ where: { projectId, tenantId }, order: { createdAt: 'DESC' } }); }

  async findOne(id: string, tenantId: string) {
    const f = await this.fileRepo.findOne({ where: { id, tenantId } });
    if (!f) throw new NotFoundException('File not found');
    return f;
  }

  async getDownloadUrl(id: string, tenantId: string): Promise<string> {
    const f = await this.findOne(id, tenantId);
    return this.storage.getPresignedUrl(f.storageKey, 3600);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const f = await this.findOne(id, tenantId);
    await this.storage.deleteFile(f.storageKey);
    await this.fileRepo.remove(f);
  }
}
