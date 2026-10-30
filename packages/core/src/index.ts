export const VERSION = "0.1.0";

export interface GeoLocation {
  latitude: number;
  longitude: number;
  source: "exif" | "browser" | "manual";
  accuracyMeters?: number;
}

export type SeverityLevel = "low" | "medium" | "high" | "critical";

export interface DamageFinding {
  id: string;
  concept: string;
  confidence: number;
  relativeAreaPercent: number;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
  };
  rasterMaskBase64?: string;
  polygonPoints?: [number, number][];
}

export interface InspectionReport {
  id: string;
  module: "road" | "construction";
  createdAt: string;
  imageUrl: string;
  afterImageUrl?: string;
  location?: GeoLocation;
  sceneType: string;
  overallCondition: string;
  severityScore: number; // 0 to 100
  severityLevel: SeverityLevel;
  findings: DamageFinding[];
  title: string;
  summary: string;
  recommendedAction: string;
  estimatedUrgency: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
