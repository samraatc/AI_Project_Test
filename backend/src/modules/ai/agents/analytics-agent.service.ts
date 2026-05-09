import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

@Injectable()
export class AnalyticsAgentService {
  private readonly logger = new Logger(AnalyticsAgentService.name);
  private openai: OpenAI;
  constructor(private cfg: ConfigService) { this.openai = new OpenAI({ apiKey: cfg.get('ai.openaiApiKey') }); }
  async generateInsights(data: any): Promise<any> {
    if (!this.cfg.get('ai.openaiApiKey')) return { narrative: 'AI not configured.', insights: [], recommendations: [] };
    try {
      const r = await this.openai.chat.completions.create({ model: this.cfg.get('ai.fallbackModel', 'gpt-4o-mini'), temperature: 0.4, max_tokens: 600, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Analyse business KPI data and provide executive insights. Return JSON only.' }, { role: 'user', content: `KPIs: ${JSON.stringify(data.kpis)}\nReturn: {"narrative":"2-3 sentence summary","insights":["",""],"recommendations":["",""]}` }] });
      return JSON.parse(r.choices[0].message.content);
    } catch (err: any) { this.logger.warn(`Analytics agent error: ${err.message}`); return { narrative: 'Insufficient data for analysis.', insights: [], recommendations: [] }; }
  }
}
