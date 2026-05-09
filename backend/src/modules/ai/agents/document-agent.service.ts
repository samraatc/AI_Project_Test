import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { StorageService } from '../../storage/storage.service';
import { DocumentContext } from '../interfaces/document-context.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectFile } from '../../files/entities/project-file.entity';

@Injectable()
export class DocumentAgentService {
  private readonly logger = new Logger(DocumentAgentService.name);
  private openai: OpenAI;

  constructor(
    private cfg: ConfigService,
    private storage: StorageService,
    @InjectRepository(ProjectFile) private fileRepo: Repository<ProjectFile>,
  ) {
    this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') });
  }

  async processFiles(files: any[], project: any): Promise<DocumentContext> {
    const texts: string[] = [];

    for (const file of files) {
      try {
        this.logger.log(`Processing file: ${file.originalName} (${file.fileType})`);
        const text = await this.extractText(file);

        if (text?.trim()) {
          texts.push(`=== ${file.originalName} ===\n${text}`);
          // Update file with extracted text
          await this.fileRepo.update(file.id, {
            ocrText:     text,
            ocrStatus:   'done',
            parseStatus: 'done',
          });
        } else {
          this.logger.warn(`No text extracted from: ${file.originalName}`);
          await this.fileRepo.update(file.id, {
            ocrStatus:   'done',
            parseStatus: 'done',
            ocrText:     `[No text content extracted from ${file.originalName}]`,
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to process ${file.originalName}: ${err.message}`);
        await this.fileRepo.update(file.id, { ocrStatus: 'failed', parseStatus: 'failed' }).catch(() => {});
      }
    }

    const combined = texts.join('\n\n');
    const structured = combined.trim() ? await this.extractStructured(combined, project) : { scope_summary: '', project_type: '', client_name: null, detected_items: [] };

    return {
      extractedText:  combined || `Project: ${project.name}\nIndustry: ${project.industry || 'N/A'}`,
      scopeSummary:   structured.scope_summary  || '',
      projectType:    structured.project_type   || project.projectType || project.industry || '',
      clientName:     structured.client_name    || null,
      detectedItems:  structured.detected_items || [],
      fileCount:      files.length,
    };
  }

  async extractText(file: any): Promise<string> {
    const buffer = await this.storage.downloadFile(file.storageKey);

    switch (file.fileType) {
      case 'pdf':   return this.extractPdf(buffer);
      case 'excel': return this.extractExcel(buffer);
      case 'word':  return this.extractWord(buffer);
      case 'csv':   return buffer.toString('utf-8');
      case 'image': return this.extractImage(buffer, file.mimeType, file.originalName);
      default:
        // Try as text, fallback to image vision
        const txt = buffer.toString('utf-8').trim();
        return txt.length > 10 ? txt : this.extractImage(buffer, file.mimeType, file.originalName);
    }
  }

  // ── PDF extraction ────────────────────────────────────────────
  private async extractPdf(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      if (data.text?.trim()) return data.text;
      // Scanned PDF - try Vision
      return this.extractImageFromBuffer(buffer, 'application/pdf', 'document.pdf');
    } catch (err: any) {
      this.logger.warn(`PDF parse failed: ${err.message}`);
      return '';
    }
  }

  // ── Excel extraction ──────────────────────────────────────────
  private extractExcel(buffer: Buffer): string {
    try {
      const XLSX = require('xlsx');
      const wb   = XLSX.read(buffer, { type: 'buffer' });
      return wb.SheetNames
        .map((n: string) => `--- ${n} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`)
        .join('\n\n');
    } catch (err: any) {
      this.logger.warn(`Excel parse failed: ${err.message}`);
      return '';
    }
  }

  // ── Word extraction ───────────────────────────────────────────
  private async extractWord(buffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const result  = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (err: any) {
      this.logger.warn(`Word parse failed: ${err.message}`);
      return '';
    }
  }

  // ── Image extraction — GPT-4o Vision (primary for images) ─────
  private async extractImage(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    // Only JPEG, PNG, GIF, WEBP supported by OpenAI Vision
    const supportedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mime = (mimeType || 'image/jpeg').toLowerCase();
    const supported = supportedMimes.some(m => mime.includes(m.split('/')[1]));

    if (!supported) {
      this.logger.warn(`Image type ${mimeType} not supported by Vision, trying Tesseract`);
      return this.extractOcr(buffer);
    }

    return this.extractImageFromBuffer(buffer, mime, filename);
  }

  // ── Core Vision API call ──────────────────────────────────────
  private async extractImageFromBuffer(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    if (!this.cfg.get('ai.openaiApiKey')) {
      this.logger.warn('No OpenAI key — skipping Vision extraction');
      return '';
    }

    try {
      const base64 = buffer.toString('base64');
      const imgMime = mimeType.includes('pdf') ? 'image/jpeg' :
                      mimeType || 'image/jpeg';

      this.logger.log(`Using GPT-4o Vision for: ${filename}`);

      const response = await this.openai.chat.completions.create({
        model:       this.cfg.get('ai.primaryModel', 'gpt-4o'),
        max_tokens:  3000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an expert document extractor for engineering and construction projects. 
Extract ALL text, numbers, quantities, materials, specifications, and cost data from this image.
If this is a Bill of Quantities (BOQ), extract every line item with quantities and rates.
If this is a drawing or plan, describe the scope and dimensions.
Return the extracted content in a structured, readable format.
File name: ${filename}`,
            },
            {
              type:      'image_url',
              image_url: {
                url:    `data:${imgMime};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        }],
      });

      const extracted = response.choices[0]?.message?.content || '';
      this.logger.log(`Vision extracted ${extracted.length} chars from ${filename}`);
      return extracted;

    } catch (err: any) {
      this.logger.error(`Vision API failed for ${filename}: ${err.message}`);
      // Fallback to Tesseract
      return this.extractOcr(buffer);
    }
  }

  // ── Tesseract OCR — fallback only ────────────────────────────
  private async extractOcr(buffer: Buffer): Promise<string> {
    try {
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: () => {},
        errorHandler: () => {},
      });
      const { data: { text } } = await worker.recognize(buffer);
      await worker.terminate();
      return text || '';
    } catch (err: any) {
      this.logger.warn(`Tesseract OCR failed: ${err.message}`);
      return '';
    }
  }

  // ── Structured extraction via GPT ─────────────────────────────
  private async extractStructured(text: string, project: any): Promise<any> {
    if (!text.trim() || !this.cfg.get('ai.openaiApiKey')) {
      return { scope_summary: '', project_type: '', client_name: null, detected_items: [] };
    }
    try {
      const r = await this.openai.chat.completions.create({
        model:           this.cfg.get('ai.fallbackModel', 'gpt-4o-mini'),
        temperature:     0.1,
        max_tokens:      2000,
        response_format: { type: 'json_object' },
        messages: [{
          role:    'system',
          content: 'Extract structured project information from document text. Return JSON only.',
        }, {
          role:    'user',
          content: `Project: ${project.name}\nIndustry: ${project.industry || 'N/A'}\n\nDocument Content:\n${text.substring(0, 12000)}\n\nReturn JSON:\n{"scope_summary":"","project_type":"","client_name":null,"detected_items":[{"name":"","quantity":null,"unit":null,"specification":null,"category":"material"}]}`,
        }],
      });
      return JSON.parse(r.choices[0].message.content);
    } catch (err: any) {
      this.logger.warn(`Structured extraction failed: ${err.message}`);
      return { scope_summary: '', project_type: '', client_name: null, detected_items: [] };
    }
  }

  // ── File type detection ───────────────────────────────────────
  static detectFileType(mime: string, name: string): string {
    if (mime?.includes('pdf')         || name?.match(/\.pdf$/i))         return 'pdf';
    if (mime?.includes('excel')       || mime?.includes('spreadsheet')   ||
        name?.match(/\.xlsx?$/i))                                         return 'excel';
    if (mime?.includes('word')        || name?.match(/\.docx?$/i))       return 'word';
    if (mime?.includes('image')       || name?.match(/\.(png|jpe?g|tiff?|bmp|webp|gif)$/i)) return 'image';
    if (name?.match(/\.csv$/i))                                           return 'csv';
    return 'other';
  }
}
