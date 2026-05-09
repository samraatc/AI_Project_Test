import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { PromptEngineService } from '../services/prompt-engine.service';
import { AiEstimationResult } from '../interfaces/ai-estimation-result.interface';

@Injectable()
export class EstimationAgentService {
  private readonly logger = new Logger(EstimationAgentService.name);
  private openai: OpenAI;

  constructor(private cfg: ConfigService, private prompts: PromptEngineService) {
    this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') });
  }

  async generateEstimation(project: any, docCtx: any, ragCtx: any): Promise<AiEstimationResult> {
    this.logger.log(`Generating estimation for ${project.name}`);
    const r = await this.openai.chat.completions.create({
      model: this.cfg.get('ai.primaryModel', 'gpt-4o'), temperature: 0.1, max_tokens: 8000, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: this.prompts.buildSystemPrompt('estimation', { industry: project.industry, projectType: project.projectType, currency: project.currency }) }, { role: 'user', content: this.prompts.buildEstimationPrompt({ project, docContext: docCtx, ragContext: ragCtx }) }],
    });
    let parsed: any;
    try { parsed = JSON.parse(r.choices[0].message.content); } catch { throw new Error('AI returned invalid JSON'); }
    const mapItems = (arr: any[], cat: string) => (Array.isArray(arr) ? arr : []).map((item, i) => ({ sortOrder: i, category: cat, code: item.code || '', description: item.description || item.name || 'Unknown', specification: item.specification || '', quantity: Number(item.quantity) || 0, unit: item.unit || 'unit', unitRate: Number(item.unit_rate || item.rate) || 0, discountPct: 0, source: 'ai', aiConfidence: item.confidence || null, isFlagged: item.flagged || false, flagReason: item.flag_reason || null }));
    return {
      projectName: parsed.project_name || project.name, projectSummary: parsed.project_summary || '', projectType: parsed.project_type || '', confidence: this.calcConfidence(parsed),
      items: [...mapItems(parsed.materials,'material'), ...mapItems(parsed.steel_requirements,'steel'), ...mapItems(parsed.labor_requirements,'labor'), ...mapItems(parsed.equipment_requirements,'equipment'), ...mapItems(parsed.transport_requirements,'transport')],
      estimatedCost: parsed.estimated_cost || { materialCost:0, laborCost:0, equipmentCost:0, overheadCost:0, tax:0, profitMargin:0, finalTotal:0 },
      riskAnalysis: parsed.risk_analysis || [], missingItems: parsed.missing_items || [], recommendations: parsed.recommendations || [],
      modelUsed: r.model, promptTokens: r.usage?.prompt_tokens || 0, outputTokens: r.usage?.completion_tokens || 0, rawResponse: parsed,
    };
  }

  private calcConfidence(p: any): number {
    let s = 70;
    if ((p.materials || []).length > 3) s += 10;
    if ((p.missing_items || []).length === 0) s += 10;
    if (p.estimated_cost?.final_total > 0) s += 10;
    if ((p.missing_items || []).length > 3) s -= 15;
    return Math.min(100, Math.max(30, s));
  }
}
