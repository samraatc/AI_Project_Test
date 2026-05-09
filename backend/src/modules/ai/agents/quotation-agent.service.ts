import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { PromptEngineService } from '../services/prompt-engine.service';

@Injectable()
export class QuotationAgentService {
  private openai: OpenAI;
  constructor(private cfg: ConfigService, private prompts: PromptEngineService) { this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') }); }
  async draft(project: any, estimation: any, tenantName: string, client: any): Promise<any> {
    try {
      const r = await this.openai.chat.completions.create({ model: this.cfg.get('ai.primaryModel', 'gpt-4o'), temperature: 0.4, max_tokens: 3000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: this.prompts.buildSystemPrompt('quotation', { industry: project.industry }) }, { role: 'user', content: this.prompts.buildQuotationPrompt({ project, estimation, client, tenantName }) }] });
      return JSON.parse(r.choices[0].message.content);
    } catch { return { scope_summary: 'Professional services as per project requirements.', terms_conditions: 'Standard terms apply.', deliverables: [], exclusions: [], assumptions: [], payment_terms: '30-40-30 milestone basis.', executive_summary: 'Quotation for professional engineering services.' }; }
  }
}
