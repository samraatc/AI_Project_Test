import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import * as nodemailer from 'nodemailer';
import { Quotation } from './entities/quotation.entity';
import { Estimation } from '../estimations/entities/estimation.entity';
import { Project } from '../projects/entities/project.entity';
import { StorageService } from '../storage/storage.service';
import { PromptEngineService } from '../ai/services/prompt-engine.service';

const HTML_TEMPLATE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10pt;color:#1a1a1a}.hdr{background:#1e3a5f;color:white;padding:28px 32px;display:flex;justify-content:space-between}.hdr h1{font-size:20pt;font-weight:300}.meta{background:#f5f7fa;padding:14px 32px;border-bottom:1px solid #e0e0e0;font-size:9pt}.sec{padding:18px 32px;border-bottom:1px solid #f0f0f0}.sec h2{font-size:10pt;font-weight:600;color:#1e3a5f;margin-bottom:8px;text-transform:uppercase}table.items{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:8px}table.items thead tr{background:#1e3a5f;color:white}table.items th{padding:7px 8px;text-align:left}table.items th:last-child,table.items td:last-child{text-align:right}table.items td{padding:6px 8px;border-bottom:1px solid #f0f0f0}.totals{padding:16px 32px}.totals table{max-width:320px;margin-left:auto}.totals td{padding:5px 8px;font-size:9.5pt}.totals td:last-child{text-align:right;font-weight:500}.tot-final td{border-top:2px solid #1e3a5f;font-size:11pt;font-weight:700;color:#1e3a5f}.footer{padding:14px 32px;background:#f5f7fa;font-size:8pt;color:#888;text-align:center}</style></head><body>
<div class="hdr"><div><h1>QUOTATION</h1><div style="margin-top:4px;font-size:10pt;opacity:0.7">{{projectName}}</div></div><div style="text-align:right"><div style="font-size:13pt;font-weight:600">{{quoteNumber}}</div><div>Date: {{date}}</div><div>Valid Until: {{validUntil}}</div></div></div>
<div class="meta"><strong>Prepared For:</strong> {{clientName}}</div>
{{#if scopeSummary}}<div class="sec"><h2>Scope of Work</h2><p style="font-size:9.5pt;line-height:1.7">{{scopeSummary}}</p></div>{{/if}}
<div class="sec"><h2>Cost Breakdown</h2><table class="items"><thead><tr><th>Description</th><th style="width:70px">Qty</th><th style="width:50px">Unit</th><th style="width:90px">Rate ({{currency}})</th><th style="width:100px">Total ({{currency}})</th></tr></thead><tbody>{{#each itemGroups}}<tr style="background:#e8ecf1"><td colspan="5" style="padding:6px 8px;font-weight:600;color:#1e3a5f">{{category}}</td></tr>{{#each items}}<tr><td>{{description}}</td><td>{{quantity}}</td><td>{{unit}}</td><td style="text-align:right">{{unitRate}}</td><td>{{total}}</td></tr>{{/each}}{{/each}}</tbody></table></div>
<div class="totals"><table><tr><td>Subtotal</td><td>{{currency}} {{subtotal}}</td></tr><tr><td>Tax</td><td>{{currency}} {{taxAmount}}</td></tr><tr class="tot-final"><td>TOTAL</td><td>{{currency}} {{finalTotal}}</td></tr></table></div>
{{#if termsConditions}}<div class="sec"><h2>Terms & Conditions</h2><p style="font-size:9pt;line-height:1.6">{{termsConditions}}</p></div>{{/if}}
<div class="footer">Valid until {{validUntil}}. Prices subject to change after expiry.</div></body></html>`;

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);
  private openai: OpenAI;
  private mailer: nodemailer.Transporter;

  constructor(
    @InjectRepository(Quotation)  private quoteRepo: Repository<Quotation>,
    @InjectRepository(Estimation) private estRepo:   Repository<Estimation>,
    @InjectRepository(Project)    private projRepo:  Repository<Project>,
    private cfg: ConfigService, private storage: StorageService, private prompts: PromptEngineService,
  ) {
    this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') });
    const host = cfg.get('storage.emailHost');
    if (host) this.mailer = nodemailer.createTransport({ host, port: cfg.get('storage.emailPort',587), secure: cfg.get('storage.emailSecure',false), auth: { user: cfg.get('storage.emailUser'), pass: cfg.get('storage.emailPass') } });
  }

  async generate(dto: any, tenantId: string, userId: string): Promise<Quotation> {
    const est  = await this.estRepo.findOne({ where: { id: dto.estimationId, tenantId }, relations: ['items'] });
    if (!est) throw new NotFoundException('Estimation not found');
    const proj = await this.projRepo.findOne({ where: { id: est.projectId, tenantId } });
    const quoteNumber = await this.nextQuoteNumber(tenantId);
    const aiContent   = await this.aiDraft(proj, est, tenantId);
    const validUntil  = new Date(); validUntil.setDate(validUntil.getDate() + (dto.validityDays||30));
    return this.quoteRepo.save(this.quoteRepo.create({ estimationId: est.id, projectId: proj.id, tenantId, createdBy: userId, quoteNumber, title: dto.title || `Quotation — ${proj.name}`, status: 'draft', scopeSummary: aiContent.scope_summary, termsConditions: aiContent.terms_conditions, validityDays: dto.validityDays||30, validUntil, subtotal: est.subtotal, taxAmount: est.taxAmount, finalTotal: est.finalTotal, currency: est.currency, aiGenerated: true, metadata: { deliverables: aiContent.deliverables, exclusions: aiContent.exclusions, paymentTerms: aiContent.payment_terms, executiveSummary: aiContent.executive_summary } }));
  }

  async generatePdf(id: string, tenantId: string): Promise<Buffer> {
    const q   = await this.findOne(id, tenantId);
    const est = await this.estRepo.findOne({ where: { id: q.estimationId }, relations: ['items'] });
    const proj = await this.projRepo.findOne({ where: { id: q.projectId } });
    const html = this.renderHtml(q, est, proj);
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', margin: { top:'20mm', right:'15mm', bottom:'20mm', left:'15mm' }, printBackground: true });
      await browser.close();
      const key = this.storage.buildQuotationKey(tenantId, id);
      await this.storage.uploadBuffer(key, Buffer.from(pdf), 'application/pdf');
      await this.quoteRepo.update(id, { pdfStorageKey: key });
      return Buffer.from(pdf);
    } catch (err: any) { this.logger.error(`PDF generation failed: ${err.message}`); throw new BadRequestException('PDF generation failed. Ensure puppeteer/chromium is installed.'); }
  }

  async sendByEmail(id: string, dto: any, tenantId: string): Promise<void> {
    if (!this.mailer) throw new BadRequestException('Email not configured');
    const q    = await this.findOne(id, tenantId);
    const proj = await this.projRepo.findOne({ where: { id: q.projectId } });
    const pdf  = await this.generatePdf(id, tenantId);
    await this.mailer.sendMail({ from: this.cfg.get('storage.emailFrom'), to: dto.recipientEmail, subject: dto.subject || `Quotation ${q.quoteNumber} — ${proj.name}`, html: `<p>Please find attached our quotation ${q.quoteNumber}.</p><p><strong>${q.currency} ${Number(q.finalTotal).toLocaleString()}</strong></p>`, attachments: [{ filename: `${q.quoteNumber}.pdf`, content: pdf, contentType: 'application/pdf' }] });
    await this.quoteRepo.update(id, { status: 'sent', sentAt: new Date(), sentToEmail: dto.recipientEmail });
  }

  async findAll(tenantId: string) { return this.quoteRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 200 }); }
  async findByProject(projectId: string, tenantId: string) { return this.quoteRepo.find({ where: { projectId, tenantId }, order: { createdAt: 'DESC' } }); }

  async findOne(id: string, tenantId: string): Promise<Quotation> {
    const q = await this.quoteRepo.findOne({ where: { id, tenantId } });
    if (!q) throw new NotFoundException('Quotation not found');
    return q;
  }

  async update(id: string, dto: any, tenantId: string): Promise<Quotation> {
    await this.findOne(id, tenantId);
    await this.quoteRepo.update({ id, tenantId }, dto);
    return this.findOne(id, tenantId);
  }

  private async aiDraft(project: any, est: any, tenantId: string): Promise<any> {
    try {
      const r = await this.openai.chat.completions.create({ model: this.cfg.get('ai.primaryModel','gpt-4o'), temperature: 0.4, max_tokens: 2000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: this.prompts.buildSystemPrompt('quotation', { industry: project.industry }) }, { role: 'user', content: this.prompts.buildQuotationPrompt({ project, estimation: est, client: null, tenantName: 'Your Company' }) }] });
      return JSON.parse(r.choices[0].message.content);
    } catch { return { scope_summary: 'Engineering services as per project requirements.', terms_conditions: 'Standard terms apply.', deliverables: [], exclusions: [], payment_terms: '30-40-30 milestone basis.', executive_summary: '' }; }
  }

  private renderHtml(q: Quotation, est: any, proj: any): string {
    const fmt = (n: number) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const grouped: Record<string,any[]> = {};
    (est.items||[]).forEach((i: any) => { grouped[i.category] = grouped[i.category]||[]; grouped[i.category].push(i); });
    const Handlebars = require('handlebars');
    const compiled = Handlebars.compile(HTML_TEMPLATE);
    return compiled({
      quoteNumber: q.quoteNumber, date: new Date().toLocaleDateString(), validUntil: q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—',
      projectName: proj?.name||'', clientName: proj?.client?.name||'Valued Client', scopeSummary: q.scopeSummary, termsConditions: q.termsConditions, currency: q.currency,
      subtotal: fmt(Number(q.subtotal)), taxAmount: fmt(Number(q.taxAmount)), finalTotal: fmt(Number(q.finalTotal)),
      itemGroups: Object.entries(grouped).map(([cat, items]) => ({ category: cat.charAt(0).toUpperCase()+cat.slice(1), items: (items as any[]).map(i => ({ description: i.description, quantity: i.quantity, unit: i.unit, unitRate: fmt(Number(i.unitRate)), total: fmt(Number(i.totalAmount)) })) })),
    });
  }

  private async nextQuoteNumber(tenantId: string): Promise<string> {
    const count = await this.quoteRepo.count({ where: { tenantId } });
    return `QT-${new Date().getFullYear()}-${String(count+1).padStart(4,'0')}`;
  }
}
