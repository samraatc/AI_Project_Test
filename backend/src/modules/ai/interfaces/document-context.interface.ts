export interface DocumentContext {
  extractedText: string;
  scopeSummary: string;
  projectType: string;
  clientName: string | null;
  detectedItems: Array<{ name: string; quantity: number | null; unit: string | null; specification: string | null; category: string; }>;
  fileCount: number;
}
