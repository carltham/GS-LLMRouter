export type Complexity = "simple" | "complex";

export interface CatalogModel {
  id: string;
  name: string;
  modelType: string;
  inputPrice: number | null;
  outputPrice: number | null;
  contextWindow: number | null;
  apiFormats: string[];
  outputModalities: string[];
  toolsSupported: boolean | null;
  raw: unknown;
}

export interface ModelProfile {
  id: string;
  name: string;
  inputPrice: number | null;
  outputPrice: number | null;
  contextWindow: number | null;
  apiFormats: string[];
  outputModalities: string[];
  toolsSupported: boolean | null;
  qualityTier: number | null;
  enabled: boolean;
}

export interface DecisionRecord {
  id: string;
  modelId: string;
  complexity: Complexity;
  successRate: number;
  feedbackCount: number;
}
