import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { StorageService } from '../../storage/storage.service';
import { DocumentContext } from '../interfaces/document-context.interface';

@Injectable()
export class DocumentAgentService {
  private readonly logger = new Logger(DocumentAgentService.name);
  private openai: OpenAI;

  constructor(private cfg: ConfigService, private storage: StorageService) {
    this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') });
  }

  async processFiles(files: any[], project: any): Promise<DocumentContext> {
    const texts: string[] = [];
    for (const file of files) {
      try {
        const text = await this.extractText(file);
        if (text) texts.push(`=== ${file.originalName} ===\n${text}`);
      } catch (err: any) {
        this.logger.warn(`Failed to extract ${file.originalName}: ${err.message}`);
      }
    }
    const combined = texts.join('\n\n');
    const structured = await this.extractStructured(combined, project);
    return { extractedText: combined, scopeSummary: structured.scope_summary || '', projectType: structured.project_type || project.projectType || '', clientName: structured.client_name || null, detectedItems: structured.detected_items || [], fileCount: files.length };
  }

  async extractText(file: any): Promise<string> {
    const buffer = await this.storage.downloadFile(file.storageKey);
    switch (file.fileType) {
      case 'pdf':   return this.extractPdf(buffer);
      case 'excel': return this.extractExcel(buffer);
      case 'word':  return this.extractWord(buffer);
      case 'csv':   return buffer.toString('utf-8');
      case 'image': return this.extractOcr(buffer);
      default:      return buffer.toString('utf-8');
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    try { const pdfParse = require('pdf-parse'); const d = await pdfParse(buffer); return d.text; } catch { return this.extractOcr(buffer); }
  }

  private extractExcel(buffer: Buffer): string {
    const XLSX = require('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    return wb.SheetNames.map((n: string) => `--- ${n} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n');
  }

  private async extractWord(buffer: Buffer): Promise<string> {
    const mammoth = require('mammoth');
    const r = await mammoth.extractRawText({ buffer });
    return r.value;
  }

  private async extractOcr(buffer: Buffer): Promise<string> {
    try { const { createWorker } = require('tesseract.js'); const w = await createWorker('eng'); const { data: { text } } = await w.recognize(buffer); await w.terminate(); return text; } catch { return ''; }
  }

  private async extractStructured(text: string, project: any): Promise<any> {
    if (!text.trim() || !this.cfg.get('ai.openaiApiKey')) return { scope_summary: '', detected_items: [] };
    try {
      const r = await this.openai.chat.completions.create({ model: this.cfg.get('ai.fallbackModel', 'gpt-4o-mini'), temperature: 0.1, max_tokens: 2000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Extract structured project info. Return JSON only.' }, { role: 'user', content: `Project: ${project.name}\n\nDocs:\n${text.substring(0,12000)}\n\nReturn: {"scope_summary":"","project_type":"","client_name":null,"detected_items":[{"name":"","quantity":null,"unit":null,"specification":null,"category":"material"}]}` }] });
      return JSON.parse(r.choices[0].message.content);
    } catch { return { scope_summary: '', detected_items: [] }; }
  }

  static detectFileType(mime: string, name: string): string {
    if (mime?.includes('pdf') || name?.match(/\.pdf$/i)) return 'pdf';
    if (mime?.includes('excel') || mime?.includes('spreadsheet') || name?.match(/\.xlsx?$/i)) return 'excel';
    if (mime?.includes('word') || name?.match(/\.docx?$/i)) return 'word';
    if (mime?.includes('image') || name?.match(/\.(png|jpe?g|tiff?|bmp)$/i)) return 'image';
    if (name?.match(/\.csv$/i)) return 'csv';
    return 'other';
  }
}
