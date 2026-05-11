import { OpenAI } from 'openai';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Estimation } from './entities/estimation.entity';
import { EstimationItem } from './entities/estimation-item.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Injectable()
export class EstimationsService {
  constructor(
    @InjectRepository(Estimation)     private estRepo:   Repository<Estimation>,
    @InjectRepository(EstimationItem) private itemRepo:  Repository<EstimationItem>,
    @InjectRepository(AuditLog)       private auditRepo: Repository<AuditLog>,
    private ds: DataSource,
  ) {}

  async findByProject(projectId: string, tenantId: string) {
    return this.estRepo.find({ where: { projectId, tenantId }, order: { versionNumber: 'DESC' }, select: ['id','title','versionNumber','status','finalTotal','currency','aiConfidence','isLocked','createdAt','updatedAt'] });
  }

  async findAll(tenantId: string, query: any = {}) {
    const { status, page = 1, limit = 50 } = query;
    const where: any = { tenantId };
    if (status) where.status = status;
    const [data, total] = await this.estRepo.findAndCount({ where, order: { updatedAt: 'DESC' }, skip: (page-1)*limit, take: limit });
    return { data, total, page, pages: Math.ceil(total/limit) };
  }

  async findOne(id: string, tenantId: string) {
    const e = await this.estRepo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!e) throw new NotFoundException('Estimation not found');
    e.items?.sort((a,b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder);
    return e;
  }

  async create(dto: any, tenantId: string, userId: string) {
    const latest = await this.estRepo.findOne({ where: { projectId: dto.projectId, tenantId }, order: { versionNumber: 'DESC' } });
    const vn = (latest?.versionNumber || 0) + 1;
    const saved = await this.estRepo.save(this.estRepo.create({ ...dto, tenantId, createdBy: userId, versionNumber: vn, title: dto.title || `Estimation v${vn}` })) as unknown as Estimation;
    await this.audit(tenantId, userId, 'estimation.created', saved.id);
    return saved;
  }

  async update(id: string, dto: any, tenantId: string, userId: string) {
    const e = await this.findOne(id, tenantId);
    this.assertUnlocked(e);
    await this.estRepo.update({ id, tenantId }, dto);
    if (dto.overheadPct !== undefined || dto.taxPct !== undefined || dto.profitMarginPct !== undefined) await this.recalcFromItems(id, tenantId);
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
      item = this.itemRepo.create({ ...dto, estimationId, tenantId, sortOrder: maxOrder+1, source: 'manual' }) as unknown as EstimationItem;
    }
    item.totalAmount = Number(item.quantity||0) * Number(item.unitRate||0) * (1 - Number(item.discountPct||0)/100);
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
      const totalAmount = Number(item.quantity||0) * Number(item.unitRate||0) * (1 - Number(item.discountPct||0)/100);
      if (item.id) await this.itemRepo.update({ id: item.id, estimationId }, { ...item, totalAmount });
      else await this.itemRepo.save(this.itemRepo.create({ ...item, estimationId, tenantId, totalAmount, source: 'manual' }));
    }
    await this.recalcFromItems(estimationId, tenantId);
    return this.findOne(estimationId, tenantId);
  }

  async createVersion(id: string, tenantId: string, userId: string) {
    const src = await this.findOne(id, tenantId);
    const newVersion = await this.estRepo.save(this.estRepo.create({ ...src, id: undefined, versionNumber: src.versionNumber+1, title: `${src.title.replace(/ v\d+$/,'')} v${src.versionNumber+1}`, status: 'draft', isLocked: false, lockedAt: null, lockedBy: null, parentId: src.id, createdBy: userId, createdAt: undefined, updatedAt: undefined }));
    const items = src.items.map(i => this.itemRepo.create({ ...i, id: undefined, estimationId: newVersion.id, createdAt: undefined, updatedAt: undefined }));
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
    return { version1: { id: v1.id, title: v1.title, total: v1.finalTotal }, version2: { id: v2.id, title: v2.title, total: v2.finalTotal }, totalDiff: Number(v2.finalTotal) - Number(v1.finalTotal), changes: { added: v2.items.filter(i => !m1.has(i.description)), removed: v1.items.filter(i => !m2.has(i.description)), changed: v2.items.filter(i => { const o = m1.get(i.description) as any; return o && (o.quantity !== i.quantity || o.unitRate !== i.unitRate); }) } };
  }

  private async recalcFromItems(estimationId: string, tenantId: string) {
    const e = await this.estRepo.findOne({ where: { id: estimationId, tenantId } });
    const items = await this.itemRepo.find({ where: { estimationId } });
    const sum = (cats: string[]) => items.filter(i => cats.includes(i.category)).reduce((s,i) => s + Number(i.totalAmount), 0);
    const matC = sum(['material']); const steelC = sum(['steel']); const labC = sum(['labor']); const eqC = sum(['equipment']); const trC = sum(['transport']);
    const base = matC + steelC + labC + eqC + trC;
    const ovhPct = Number(e.overheadPct)||8; const taxPct = Number(e.taxPct)||5; const profPct = Number(e.profitMarginPct)||15;
    const ovh = base * ovhPct/100; const sub = base + ovh; const tax = sub * taxPct/100; const prof = sub * profPct/100;
    await this.estRepo.update(estimationId, { materialCost:matC, steelCost:steelC, laborCost:labC, equipmentCost:eqC, transportCost:trC, overheadCost:ovh, subtotal:sub, taxAmount:tax, profitAmount:prof, finalTotal:sub+tax+prof });
  }

  private assertUnlocked(e: Estimation) { if (e.isLocked) throw new ForbiddenException('Estimation is locked. Create a new version.'); }
  private async audit(tenantId: string, userId: string, action: string, entityId: string) {
    await this.auditRepo.save(this.auditRepo.create({ tenantId, userId, action, entityType: 'estimation', entityId }));
  }
  async chatWithEstimation(
    estimationId: string,
    message: string,
    history: Array<{ role: string; content: string }>,
    tenantId: string,
  ): Promise<{ reply: string }> {
    // Load estimation with all items for context
    const est = await this.findOne(estimationId, tenantId) as any;
    if (!est) throw new Error('Estimation not found');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are an AI estimation assistant for EstimateOS. You help users understand, review, and modify cost estimations for engineering and construction projects.

CURRENT ESTIMATION CONTEXT:
- Title: ${est.title}
- Project: ${est.project?.name || 'N/A'}
- Total: ${est.currency} ${Number(est.finalTotal || 0).toLocaleString()}
- Status: ${est.status}
- AI Confidence: ${est.aiConfidence}%
- Items: ${(est.items || []).length} line items
- Categories: ${[...new Set((est.items || []).map((i: any) => i.category))].join(', ')}

LINE ITEMS SUMMARY:
${(est.items || []).slice(0, 30).map((i: any) =>
  `- ${i.category} | ${i.description} | Qty: ${i.quantity} ${i.unit} | Rate: ${est.currency} ${i.unitRate} | Total: ${est.currency} ${Number((i.quantity || 0) * (i.unitRate || 0)).toLocaleString()}`
).join('\n')}

IMPORTANT RULES:
1. You ONLY discuss topics related to this estimation, project costs, quantities, materials, labor, equipment, pricing, and construction/engineering matters.
2. If asked anything unrelated to estimations, costs, engineering, or this project, respond with: "I'm only able to assist with estimation-related questions for this project. Please ask me about the costs, quantities, items, or analysis for this estimation."
3. When users want to modify items, suggest they use the line items editor below the chat.
4. Be concise, professional, and helpful about cost analysis.
5. You can explain AI confidence scores, flag reasons, cost breakdowns, and provide insights about the estimation.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_PRIMARY_MODEL || 'gpt-4o',
      messages,
      max_tokens: 1000,
      temperature: 0.3,
    });

    return { reply: response.choices[0].message.content || 'I could not generate a response. Please try again.' };
  }

}
