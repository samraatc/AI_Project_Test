export interface RagContext {
  relevantChunks: Array<{ text: string; score: number; fileId: string; chunkIdx: number; }>;
  similarProjects: Array<{ projectId: string; name: string; total: number; currency: string; industry: string; score: number; }>;
  pricingItems: Array<{ name: string; unit: string; unitRate: number; currency: string; category: string; }>;
}
