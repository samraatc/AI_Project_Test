import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Client } from './entities/client.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)   private repo:      Repository<Client>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(tenantId: string, query: any = {}) {
    const { search, status, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (search) {
      const [data, total] = await this.repo.findAndCount({ where: [{ tenantId, name: ILike(`%${search}%`) }, { tenantId, email: ILike(`%${search}%`) }], order: { name: 'ASC' }, skip: (page-1)*limit, take: limit });
      return { data, total, page, pages: Math.ceil(total/limit) };
    }
    const [data, total] = await this.repo.findAndCount({ where, order: { name: 'ASC' }, skip: (page-1)*limit, take: limit });
    return { data, total, page, pages: Math.ceil(total/limit) };
  }

  async findOne(id: string, tenantId: string) {
    const c = await this.repo.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Client not found');
    return c;
  }

  async create(dto: any, tenantId: string, userId: string) {
    if (dto.email) {
      const ex = await this.repo.findOne({ where: { email: dto.email, tenantId } });
      if (ex) throw new ConflictException('Client email already exists');
    }
    const saved = await this.repo.save(this.repo.create({ ...dto, tenantId, createdBy: userId })) as unknown as Client;
    await this.auditRepo.save(this.auditRepo.create({ tenantId, userId, action: 'client.created', entityType: 'client', entityId: saved.id }));
    return saved;
  }

  async update(id: string, dto: any, tenantId: string, userId: string) {
    await this.findOne(id, tenantId);
    await this.repo.update({ id, tenantId }, dto);
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string, userId: string) {
    await this.findOne(id, tenantId);
    await this.repo.update({ id, tenantId }, { status: 'inactive' });
  }

  async getStats(tenantId: string) {
    const [total, active] = await Promise.all([this.repo.count({ where: { tenantId } }), this.repo.count({ where: { tenantId, status: 'active' } })]);
    return { total, active, inactive: total - active };
  }
}
