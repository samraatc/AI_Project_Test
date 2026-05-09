import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { PromptEngineService } from '../services/prompt-engine.service';

@Injectable()
export class CostOptimAgent {
  private readonly logger = new Logger(CostOptimAgent.name);
  private openai: OpenAI;
  constructor(private cfg: ConfigService, private prompts: PromptEngineService) { this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') }); }
  async analyze(estimation: any, _tenantId: string): Promise<any> {
    if (!estimation.items?.length) return { suggestions: [], total_potential_saving: 0 };
    try {
      const r = await this.openai.chat.completions.create({ model: this.cfg.get('ai.fallbackModel', 'gpt-4o-mini'), temperature: 0.2, max_tokens: 2000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: this.prompts.buildSystemPrompt('cost_optimization') }, { role: 'user', content: this.prompts.buildOptimizationPrompt(estimation) }] });
      return JSON.parse(r.choices[0].message.content);
    } catch (err: any) { this.logger.warn(`Cost optim failed: ${err.message}`); return { suggestions: [], total_potential_saving: 0 }; }
  }
}
