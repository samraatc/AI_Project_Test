import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptEngineService {
  buildSystemPrompt(agentType: string, ctx: any = {}): string {
    const base = `You are an expert AI estimation engineer specialising in ${ctx.industry || 'industrial'} projects. You have deep knowledge of ${ctx.projectType || 'engineering'} projects, industry pricing, material specifications, and project costing. Respond in valid JSON only. Currency: ${ctx.currency || 'USD'}.`;
    const extras: Record<string,string> = {
      estimation: `${base}\nAnalyse documents and generate a complete itemised cost estimate. Flag uncertain items. Return JSON matching the schema exactly.`,
      quotation:  `${base}\nGenerate professional client-ready quotation content.`,
      cost_optimization: `${base}\nIdentify cost-saving opportunities without compromising quality. Give specific, quantified savings.`,
    };
    return extras[agentType] || base;
  }

  buildEstimationPrompt(opts: any): string {
    const { project, docContext, ragContext } = opts;
    return `PROJECT: ${project.name}\nINDUSTRY: ${project.industry || 'N/A'}\nCURRENCY: ${project.currency}\n\nDOCUMENT CONTENT:\n${(docContext.extractedText || '').substring(0, 12000)}\n\nSCOPE: ${docContext.scopeSummary || 'N/A'}\n\nRespond with JSON:\n{\n  "project_name": "string",\n  "project_summary": "string",\n  "project_type": "string",\n  "materials": [{"code":"","description":"","specification":"","quantity":0,"unit":"","unit_rate":0,"confidence":0,"flagged":false,"flag_reason":null}],\n  "steel_requirements": [{"description":"","grade":"","quantity":0,"unit":"MT","unit_rate":0,"confidence":0}],\n  "labor_requirements": [{"description":"","trade":"","quantity":0,"unit":"days","unit_rate":0,"confidence":0}],\n  "equipment_requirements": [{"description":"","capacity":"","quantity":0,"unit":"days","unit_rate":0,"confidence":0}],\n  "transport_requirements": [{"description":"","quantity":0,"unit":"","unit_rate":0}],\n  "estimated_cost": {"material_cost":0,"labor_cost":0,"equipment_cost":0,"overhead_cost":0,"tax":0,"profit_margin":0,"final_total":0},\n  "risk_analysis": [{"risk":"","impact":"low","probability":"low","mitigation":""}],\n  "missing_items": [{"item":"","reason":"","estimated_impact":0}],\n  "recommendations": [{"type":"cost_saving","description":"","potential_saving":0}]\n}`;
  }

  buildQuotationPrompt(opts: any): string {
    const { project, estimation, client, tenantName } = opts;
    return `Generate professional quotation for ${tenantName}.\nProject: ${project.name}\nClient: ${client?.name || 'Valued Client'}\nTotal: ${project.currency} ${estimation.finalTotal?.toLocaleString()}\n\nReturn JSON:\n{"title":"","scope_summary":"","deliverables":[],"exclusions":[],"assumptions":[],"terms_conditions":"","validity_note":"","payment_terms":"","executive_summary":""}`;
  }

  buildOptimizationPrompt(estimation: any): string {
    return `Analyse estimation and suggest cost optimisations.\nTotal: ${estimation.currency || 'USD'} ${estimation.finalTotal?.toLocaleString()}\nItems: ${JSON.stringify((estimation.items || []).slice(0,20))}\n\nReturn JSON:\n{"suggestions":[{"category":"","description":"","current_cost":0,"estimated_saving":0,"saving_pct":0,"implementation":"","risk":"low"}],"total_potential_saving":0,"summary":""}`;
  }
}
