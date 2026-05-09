export interface AiEstimationResult {
  projectName: string; projectSummary: string; projectType: string; confidence: number;
  items: Array<{ sortOrder: number; category: string; code: string; description: string; specification: string; quantity: number; unit: string; unitRate: number; discountPct: number; source: string; aiConfidence: number | null; isFlagged: boolean; flagReason: string | null; }>;
  estimatedCost: { materialCost: number; laborCost: number; equipmentCost: number; overheadCost: number; tax: number; profitMargin: number; finalTotal: number; };
  riskAnalysis: Array<{ risk: string; impact: string; probability: string; mitigation: string; }>;
  missingItems:    Array<{ item: string; reason: string; estimated_impact: number; }>;
  recommendations: Array<{ type: string; description: string; potential_saving: number; }>;
  modelUsed: string; promptTokens: number; outputTokens: number; rawResponse: any;
}
