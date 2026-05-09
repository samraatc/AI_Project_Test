import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, DataSource } from 'typeorm';
import { Project } from './entities/project.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)  private repo:      Repository<Project>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private ds: DataSource,
  ) {}

  async findAll(tenantId: string, query: any = {}) {
    const { search, status, industry, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (status)   where.status   = status;
    if (industry) where.industry = industry;
    if (search) {
      const [data, total] = await this.repo.findAndCount({ where: [{ tenantId, name: ILike(`%${search}%`) }], relations: ['client'], order: { updatedAt: 'DESC' }, skip: (page-1)*limit, take: limit });
      return { data, total, page, pages: Math.ceil(total/limit) };
    }
    const [data, total] = await this.repo.findAndCount({ where, relations: ['client'], order: { updatedAt: 'DESC' }, skip: (page-1)*limit, take: limit });
    return { data, total, page, pages: Math.ceil(total/limit) };
  }

  async findOne(id: string, tenantId: string) {
    const p = await this.repo.findOne({ where: { id, tenantId }, relations: ['client'] });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  async create(dto: any, tenantId: string, userId: string) {
    const saved = await this.repo.save(this.repo.create({ ...dto, tenantId, createdBy: userId, status: dto.status || 'draft' })) as unknown as Project;
    await this.auditRepo.save(this.auditRepo.create({ tenantId, userId, action: 'project.created', entityType: 'project', entityId: saved.id }));
    return saved;
  }

  async update(id: string, dto: any, tenantId: string, userId: string) {
    await this.findOne(id, tenantId);
    await this.repo.update({ id, tenantId }, dto);
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string, userId: string) {
    const p = await this.findOne(id, tenantId);
    await this.repo.softRemove(p);
  }

  async clone(id: string, tenantId: string, userId: string) {
    const source = await this.findOne(id, tenantId);
    const { id: _id, createdAt, updatedAt, deletedAt, ...rest } = source as any;
    const cloned = await this.repo.save(this.repo.create({ ...rest, name: `${source.name} (Copy)`, status: 'draft', aiStatus: 'pending', clonedFrom: source.id, createdBy: userId }));
    return cloned;
  }

  async getStats(tenantId: string) {
    const [total, draft, active, completed] = await Promise.all([this.repo.count({ where: { tenantId } }), this.repo.count({ where: { tenantId, status: 'draft' } }), this.repo.count({ where: { tenantId, status: 'active' } }), this.repo.count({ where: { tenantId, status: 'completed' } })]);
    return { total, draft, active, completed };
  }
}
