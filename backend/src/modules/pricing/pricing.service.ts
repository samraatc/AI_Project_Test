import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { PricingItem } from './entities/pricing-item.entity';

@Injectable()
export class PricingService {
  constructor(@InjectRepository(PricingItem) private repo: Repository<PricingItem>) {}
  async findAll(tenantId: string, q: any = {}) {
    const { search, category, currency } = q;
    const where: any = { tenantId, isActive: true };
    if (category) where.category = category;
    if (currency) where.currency = currency;
    if (search) return this.repo.find({ where: [{ tenantId, name: ILike(`%${search}%`) }, { tenantId, code: ILike(`%${search}%`) }], order: { category:'ASC', name:'ASC' } });
    return this.repo.find({ where, order: { category:'ASC', name:'ASC' } });
  }
  async findOne(id: string, tenantId: string) {
    const i = await this.repo.findOne({ where: { id, tenantId } });
    if (!i) throw new NotFoundException('Pricing item not found');
    return i;
  }
  async create(dto: any, tenantId: string, userId: string) { return this.repo.save(this.repo.create({ ...dto, tenantId, createdBy: userId, source: 'manual' })); }
  async update(id: string, dto: any, tenantId: string) { await this.repo.update({ id, tenantId }, dto); return this.findOne(id, tenantId); }
  async delete(id: string, tenantId: string) { await this.repo.update({ id, tenantId }, { isActive: false }); }
  async bulkImport(items: any[], tenantId: string, userId: string) { const entities = items.map(i => this.repo.create({ ...i, tenantId, createdBy: userId, source: 'imported' })); return this.repo.save(entities as any); }
  async getCategories(tenantId: string): Promise<string[]> {
    const r = await this.repo.createQueryBuilder('p').select('DISTINCT p.category','category').where('p.tenantId = :tenantId', { tenantId }).getRawMany();
    return r.map(x => x.category);
  }
}
