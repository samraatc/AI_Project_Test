import { OpenAI } from 'openai';
import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  // ── Estimation PDF export ──────────────────────────────────
  async generatePdf(id: string, tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
    const est = await this.findOne(id, tenantId) as any;
    if (!est) throw new Error('Estimation not found');

    const fmt = (n: any) => Number(n||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    // Group items by category
    const grouped: Record<string, any[]> = {};
    (est.items || []).forEach((item: any) => {
      grouped[item.category] = grouped[item.category] || [];
      grouped[item.category].push(item);
    });

    const CAT_LABELS: Record<string,string> = {
      material: 'Material', steel: 'Steel', labor: 'Labour',
      equipment: 'Equipment', transport: 'Transport', other: 'Other',
    };

    const itemRowsHtml = Object.entries(grouped).map(([cat, items]) => {
      const rows = (items as any[]).map(i => `
        <tr>
          <td>${i.code ? `<span style="color:#888;font-size:8pt">${i.code}</span><br>` : ''}${i.description}</td>
          <td style="text-align:right">${Number(i.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td>${i.unit}</td>
          <td style="text-align:right">${est.currency} ${fmt(i.unitRate)}</td>
          <td style="text-align:right${i.isFlagged ? ';color:#e53e3e' : ''}">${est.currency} ${fmt(i.totalAmount)}${i.isFlagged ? ' ⚠' : ''}</td>
        </tr>`).join('');
      return `
        <tr class="cat-row">
          <td colspan="5">${CAT_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}</td>
        </tr>
        ${rows}`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; }

  .header { background: #1e3a5f; color: white; padding: 28px 32px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { font-size: 20pt; font-weight: 300; letter-spacing: 1px; }
  .header .sub { margin-top: 4px; font-size: 9.5pt; opacity: 0.75; }
  .header .meta-right { text-align: right; }
  .header .meta-right .num { font-size: 13pt; font-weight: 600; }
  .header .meta-right div { margin-top: 3px; font-size: 9pt; opacity: 0.85; }

  .info-bar { background: #f5f7fa; padding: 12px 32px; border-bottom: 1px solid #e0e0e0; display: flex; gap: 32px; font-size: 9pt; }
  .info-bar .item { }
  .info-bar .label { color: #888; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-bar .value { font-weight: 600; color: #1a1a1a; margin-top: 2px; }

  .ai-banner { background: #ebf8ff; border-left: 4px solid #3182ce; padding: 10px 32px; font-size: 9pt; color: #2b6cb0; }

  .section { padding: 18px 32px; border-bottom: 1px solid #f0f0f0; }
  .section h2 { font-size: 10pt; font-weight: 700; color: #1e3a5f; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }

  table.items { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.items thead tr { background: #1e3a5f; color: white; }
  table.items th { padding: 8px 10px; text-align: left; font-weight: 600; }
  table.items th:not(:first-child) { text-align: right; }
  table.items th:nth-child(3) { text-align: left; }
  table.items td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .cat-row td { background: #eef2f7; font-weight: 700; color: #1e3a5f; font-size: 9pt; padding: 6px 10px; }
  table.items tr:hover td { background: #fafbff; }

  .totals { padding: 16px 32px; }
  .totals table { max-width: 340px; margin-left: auto; }
  .totals td { padding: 5px 10px; font-size: 9.5pt; }
  .totals td:last-child { text-align: right; font-weight: 500; }
  .tot-final td { border-top: 2.5px solid #1e3a5f; font-size: 12pt; font-weight: 700; color: #1e3a5f; padding-top: 8px; }

  .risks { padding: 16px 32px; }
  .risk-item { background: #fff8f0; border-left: 3px solid #ed8936; padding: 8px 12px; margin-bottom: 6px; border-radius: 0 4px 4px 0; }
  .risk-item .risk-name { font-weight: 600; font-size: 9pt; }
  .risk-item .risk-detail { font-size: 8.5pt; color: #555; margin-top: 2px; }

  .footer { padding: 14px 32px; background: #f5f7fa; font-size: 8pt; color: #888; text-align: center; }
  .confidence-bar { height: 6px; border-radius: 3px; background: #e0e0e0; margin-top: 4px; }
  .confidence-fill { height: 100%; border-radius: 3px; background: ${Number(est.aiConfidence||0) >= 80 ? '#48bb78' : Number(est.aiConfidence||0) >= 60 ? '#ed8936' : '#f56565'}; width: ${est.aiConfidence || 0}%; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    <h1>ESTIMATION</h1>
    <div class="sub">${est.project?.name || ''}</div>
  </div>
  <div class="meta-right">
    <div class="num">${est.title}</div>
    <div>Version ${est.versionNumber}</div>
    <div>Date: ${fmtDate(est.createdAt)}</div>
    <div>Status: ${(est.status || 'draft').charAt(0).toUpperCase() + (est.status || 'draft').slice(1)}</div>
  </div>
</div>

<!-- Info bar -->
<div class="info-bar">
  <div class="item">
    <div class="label">Project</div>
    <div class="value">${est.project?.name || '—'}</div>
  </div>
  <div class="item">
    <div class="label">Industry</div>
    <div class="value">${est.project?.industry ? est.project.industry.replace('_', ' & ').replace('oil & gas', 'Oil & Gas').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '—'}</div>
  </div>
  <div class="item">
    <div class="label">Currency</div>
    <div class="value">${est.currency}</div>
  </div>
  ${est.aiConfidence ? `
  <div class="item">
    <div class="label">AI Confidence</div>
    <div class="value">${est.aiConfidence}%</div>
    <div class="confidence-bar"><div class="confidence-fill"></div></div>
  </div>` : ''}
  <div class="item">
    <div class="label">Line Items</div>
    <div class="value">${(est.items || []).length} items</div>
  </div>
</div>

${est.aiConfidence ? `<div class="ai-banner">🤖 AI-Generated Estimation — ${est.aiConfidence}% Confidence Score${est.aiSummary ? ` &nbsp;|&nbsp; ${est.aiSummary.substring(0, 120)}...` : ''}</div>` : ''}

<!-- Cost Breakdown -->
<div class="section">
  <h2>Cost Breakdown</h2>
  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th style="width:80px;text-align:right">Qty</th>
        <th style="width:55px">Unit</th>
        <th style="width:110px;text-align:right">Unit Rate (${est.currency})</th>
        <th style="width:120px;text-align:right">Total (${est.currency})</th>
      </tr>
    </thead>
    <tbody>${itemRowsHtml}</tbody>
  </table>
</div>

<!-- Totals -->
<div class="totals">
  <table>
    <tr><td>Subtotal</td><td>${est.currency} ${fmt(est.subtotal)}</td></tr>
    <tr><td>Tax (${est.taxPct || 0}%)</td><td>${est.currency} ${fmt(est.taxAmount)}</td></tr>
    ${Number(est.profitAmount || 0) > 0 ? `<tr><td>Profit Margin (${est.profitMarginPct || 0}%)</td><td>${est.currency} ${fmt(est.profitAmount)}</td></tr>` : ''}
    <tr class="tot-final"><td>TOTAL</td><td>${est.currency} ${fmt(est.finalTotal)}</td></tr>
  </table>
</div>

${(est.aiRiskAnalysis || []).length > 0 ? `
<div class="section">
  <h2>Risk Analysis</h2>
  <div>
    ${(est.aiRiskAnalysis || []).map((r: any) => `
      <div class="risk-item">
        <div class="risk-name">${r.risk || r} <span style="font-weight:400;color:#888;font-size:8pt">[${r.impact || ''} impact]</span></div>
        ${r.mitigation ? `<div class="risk-detail">Mitigation: ${r.mitigation}</div>` : ''}
      </div>
    `).join('')}
  </div>
</div>` : ''}

${(est.aiRecommendations || []).length > 0 ? `
<div class="section">
  <h2>AI Recommendations</h2>
  <ul style="padding-left:18px;font-size:9pt;line-height:1.8;color:#444;">
    ${(est.aiRecommendations || []).map((r: any) => `<li>${typeof r === 'string' ? r : r.description || JSON.stringify(r)}</li>`).join('')}
  </ul>
</div>` : ''}

<div class="footer">
  ${est.title} &nbsp;|&nbsp; ${est.project?.name || ''} &nbsp;|&nbsp; Generated ${fmtDate(new Date().toISOString())} &nbsp;|&nbsp; Confidential — For Internal Use
</div>

</body>
</html>`;

    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', right: '0mm', bottom: '15mm', left: '0mm' },
        printBackground: true,
      });
      await browser.close();
      const filename = `${est.title.replace(/\s+/g, '-')}-v${est.versionNumber}.pdf`;
      return { buffer: Buffer.from(pdf), filename };
    } catch (err: any) {
      this.logger.error(`Estimation PDF generation failed: ${err.message}`);
      throw new Error('PDF generation failed. Check puppeteer/chromium is installed.');
    }
  }

}
