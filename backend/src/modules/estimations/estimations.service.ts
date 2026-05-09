import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Estimation } from './entities/estimation.entity';
import { EstimationItem } from './entities/estimation-item.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Injectable()
export class EstimationsService {
  private readonly logger = new Logger(EstimationsService.name);

  constructor(
    @InjectRepository(Estimation)     private estRepo:   Repository<Estimation>,
    @InjectRepository(EstimationItem) private itemRepo:  Repository<EstimationItem>,
    @InjectRepository(AuditLog)       private auditRepo: Repository<AuditLog>,
    private ds: DataSource,
  ) {}

  async findByProject(projectId: string, tenantId: string) {
    this.logger.debug(`findByProject called — projectId: ${projectId}, tenantId: ${tenantId}`);

    // DEBUG: Check if ANY estimations exist for this project (ignoring tenantId)
    const debugAll = await this.estRepo.find({ where: { projectId } });
    this.logger.debug(`Total estimations for projectId (any tenant): ${debugAll.length}`);
    if (debugAll.length > 0) {
      this.logger.debug(`Tenant IDs found: ${[...new Set(debugAll.map(e => e.tenantId))].join(', ')}`);
      this.logger.debug(`Your tenantId from JWT: ${tenantId}`);
    }

    const results = await this.estRepo.find({
      where: { projectId, tenantId },
      order: { versionNumber: 'DESC' },
      select: ['id','title','versionNumber','status','finalTotal','currency','aiConfidence','isLocked','createdAt','updatedAt'],
    });

    this.logger.debug(`Results with tenantId filter: ${results.length}`);
    return results;
  }

  async findAll(tenantId: string, query: any = {}) {
    const { status, page = 1, limit = 50 } = query;
    const where: any = { tenantId };
    if (status) where.status = status;
    const [data, total] = await this.estRepo.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const e = await this.estRepo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!e) throw new NotFoundException('Estimation not found');
    e.items?.sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder);
    return e;
  }

  async create(dto: any, tenantId: string, userId: string) {
    const latest = await this.estRepo.findOne({
      where: { projectId: dto.projectId, tenantId },
      order: { versionNumber: 'DESC' },
    });
    const vn = (latest?.versionNumber || 0) + 1;
    const saved = await this.estRepo.save(
      this.estRepo.create({
        ...dto,
        tenantId,
        createdBy: userId,
        versionNumber: vn,
        title: dto.title || `Estimation v${vn}`,
      }),
    ) as unknown as Estimation;
    await this.audit(tenantId, userId, 'estimation.created', saved.id);
    return saved;
  }

  async update(id: string, dto: any, tenantId: string, userId: string) {
    const e = await this.findOne(id, tenantId);
    this.assertUnlocked(e);
    await this.estRepo.update({ id, tenantId }, dto);
    if (dto.overheadPct !== undefined || dto.taxPct !== undefined || dto.profitMarginPct !== undefined) {
      await this.recalcFromItems(id, tenantId);
    }
    return this.findOne(id, tenantId);
  }

  async upsertItem(estimationId: string, dto: any, tenantId: string, userId: string) {
    const e = await this.findOne(estimationId, tenantId);
    this.assertUnlocked(e);
    let item: EstimationItem;
    if (dto.id) {
      item = await this.itemRepo.findOne({ where: { id: dto.id, estimationId, tenantId } });
      if (!item) throw new NotFoundException('Item not found');
      Object.assign(item, dto);
    } else {
      const maxOrder = await this.itemRepo.maximum('sortOrder', { estimationId }) || 0;
      item = this.itemRepo.create({
        ...dto,
        estimationId,
        tenantId,
        sortOrder: maxOrder + 1,
        source: 'manual',
      }) as unknown as EstimationItem;
    }
    item.totalAmount = Number(item.quantity || 0) * Number(item.unitRate || 0) * (1 - Number(item.discountPct || 0) / 100);
    const saved = await this.itemRepo.save(item) as EstimationItem;
    await this.recalcFromItems(estimationId, tenantId);
    return saved;
  }

  async deleteItem(estimationId: string, itemId: string, tenantId: string) {
    const e = await this.findOne(estimationId, tenantId);
    this.assertUnlocked(e);
    const item = await this.itemRepo.findOne({ where: { id: itemId, estimationId } });
    if (!item) throw new NotFoundException('Item not found');
    await this.itemRepo.remove(item);
    await this.recalcFromItems(estimationId, tenantId);
  }

  async bulkUpdateItems(estimationId: string, items: any[], tenantId: string) {
    const e = await this.findOne(estimationId, tenantId);
    this.assertUnlocked(e);
    for (const item of items) {
      const totalAmount = Number(item.quantity || 0) * Number(item.unitRate || 0) * (1 - Number(item.discountPct || 0) / 100);
      if (item.id) {
        await this.itemRepo.update({ id: item.id, estimationId }, { ...item, totalAmount });
      } else {
        await this.itemRepo.save(
          this.itemRepo.create({ ...item, estimationId, tenantId, totalAmount, source: 'manual' }),
        );
      }
    }
    await this.recalcFromItems(estimationId, tenantId);
    return this.findOne(estimationId, tenantId);
  }

  async createVersion(id: string, tenantId: string, userId: string) {
    const src = await this.findOne(id, tenantId);
    const newVersion = await this.estRepo.save(
      this.estRepo.create({
        ...src,
        id: undefined,
        versionNumber: src.versionNumber + 1,
        title: `${src.title.replace(/ v\d+$/, '')} v${src.versionNumber + 1}`,
        status: 'draft',
        isLocked: false,
        lockedAt: null,
        lockedBy: null,
        parentId: src.id,
        createdBy: userId,
        createdAt: undefined,
        updatedAt: undefined,
      }),
    );
    const items = src.items.map(i =>
      this.itemRepo.create({ ...i, id: undefined, estimationId: newVersion.id, createdAt: undefined, updatedAt: undefined }),
    );
    await this.itemRepo.save(items);
    await this.audit(tenantId, userId, 'estimation.version.created', newVersion.id);
    return newVersion;
  }

  async lock(id: string, tenantId: string, userId: string) {
    const e = await this.findOne(id, tenantId);
    if (e.isLocked) throw new BadRequestException('Already locked');
    await this.estRepo.update({ id, tenantId }, { isLocked: true, lockedAt: new Date(), lockedBy: userId, status: 'approved' });
    return { message: 'Estimation locked' };
  }

  async unlock(id: string, tenantId: string) {
    await this.estRepo.update({ id, tenantId }, { isLocked: false, lockedAt: null, lockedBy: null, status: 'draft' });
    return { message: 'Estimation unlocked' };
  }

  async compare(id1: string, id2: string, tenantId: string) {
    const [v1, v2] = await Promise.all([this.findOne(id1, tenantId), this.findOne(id2, tenantId)]);
    const m1 = new Map(v1.items.map(i => [i.description, i]));
    const m2 = new Map(v2.items.map(i => [i.description, i]));
    return {
      version1: { id: v1.id, title: v1.title, total: v1.finalTotal },
      version2: { id: v2.id, title: v2.title, total: v2.finalTotal },
      totalDiff: Number(v2.finalTotal) - Number(v1.finalTotal),
      changes: {
        added:   v2.items.filter(i => !m1.has(i.description)),
        removed: v1.items.filter(i => !m2.has(i.description)),
        changed: v2.items.filter(i => {
          const o = m1.get(i.description) as any;
          return o && (o.quantity !== i.quantity || o.unitRate !== i.unitRate);
        }),
      },
    };
  }

  private async recalcFromItems(estimationId: string, tenantId: string) {
    const e = await this.estRepo.findOne({ where: { id: estimationId, tenantId } });
    const items = await this.itemRepo.find({ where: { estimationId } });
    const sum = (cats: string[]) =>
      items.filter(i => cats.includes(i.category)).reduce((s, i) => s + Number(i.totalAmount), 0);
    const matC  = sum(['material']);
    const steelC = sum(['steel']);
    const labC  = sum(['labor']);
    const eqC   = sum(['equipment']);
    const trC   = sum(['transport']);
    const base  = matC + steelC + labC + eqC + trC;
    const ovhPct  = Number(e.overheadPct)    || 8;
    const taxPct  = Number(e.taxPct)         || 5;
    const profPct = Number(e.profitMarginPct) || 15;
    const ovh  = base * ovhPct / 100;
    const sub  = base + ovh;
    const tax  = sub * taxPct / 100;
    const prof = sub * profPct / 100;
    await this.estRepo.update(estimationId, {
      materialCost: matC, steelCost: steelC, laborCost: labC,
      equipmentCost: eqC, transportCost: trC, overheadCost: ovh,
      subtotal: sub, taxAmount: tax, profitAmount: prof,
      finalTotal: sub + tax + prof,
    });
  }

  private assertUnlocked(e: Estimation) {
    if (e.isLocked) throw new ForbiddenException('Estimation is locked. Create a new version.');
  }

  private async audit(tenantId: string, userId: string, action: string, entityId: string) {
    await this.auditRepo.save(
      this.auditRepo.create({ tenantId, userId, action, entityType: 'estimation', entityId }),
    );
  }
}