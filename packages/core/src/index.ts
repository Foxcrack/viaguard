import { z } from "zod";

export const VERSION = "0.1.0";

// --- Geolocation ---
export const GeoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.enum(["exif", "browser", "manual"]),
  accuracyMeters: z.number().optional(),
  address: z.string().optional(),
});
export type GeoLocation = z.infer<typeof GeoLocationSchema>;

// --- Severity ---
export const SeverityLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;

export const SeverityBreakdownSchema = z.object({
  rawTotalAreaPercent: z.number(),
  largestInstanceRawAreaPercent: z.number(),
  weightedTotalArea: z.number(),
  largestInstanceWeightedArea: z.number(),
  totalAreaScore: z.number(),
  largestInstanceScore: z.number(),
  countBonus: z.number(),
  damageInstanceCount: z.number(),
  averageConfidence: z.number(),
  appliedTypeWeights: z.record(z.string(), z.number()),
  rawScore: z.number(),
  finalScore: z.number(),
});
export type SeverityBreakdown = z.infer<typeof SeverityBreakdownSchema>;

// --- Bounding Box & Finding ---
export const BoundingBoxSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const DamageFindingSchema = z.object({
  id: z.string(),
  concept: z.string(),
  confidence: z.number(),
  relativeAreaPercent: z.number(),
  boundingBox: BoundingBoxSchema,
  svgPath: z.string().optional(),
  maskBounds: z
    .object({
      left: z.number(),
      top: z.number(),
      right: z.number(),
      bottom: z.number(),
    })
    .optional(),
  activePixels: z.number().optional(),
});
export type DamageFinding = z.infer<typeof DamageFindingSchema>;

// --- Scene Understanding Schema (Muse Spark Step 2) ---
export const SceneUnderstandingSchema = z.object({
  scene_type: z.string(),
  visible_damage_types: z
    .array(
      z
        .string()
        .describe("1 or 2 word plain noun only (e.g. 'pothole', 'crack', 'patch', 'manhole cover')")
    )
    .describe("Plain 1-2 word nouns suitable as single-concept SAM 3.1 prompts"),
  overall_condition: z.string(),
  notes: z.string().default(""),
});
export type SceneUnderstanding = z.infer<typeof SceneUnderstandingSchema>;

// --- Construction Diff Schema ---
export const ConceptDiffSchema = z.object({
  concept: z.string(),
  beforeCount: z.number(),
  afterCount: z.number(),
  deltaCount: z.number(),
  beforeAreaPercent: z.number(),
  afterAreaPercent: z.number(),
  deltaAreaPercent: z.number(),
  status: z.enum(["progress", "deterioration", "stable"]),
});
export type ConceptDiff = z.infer<typeof ConceptDiffSchema>;

export const ConstructionDiffSchema = z.object({
  conceptChanges: z.array(ConceptDiffSchema),
  overallAssessment: z.string(),
  progressScore: z.number(), // -100 to +100
});
export type ConstructionDiff = z.infer<typeof ConstructionDiffSchema>;

// --- Structured Report (Muse Spark Step 5) ---
export const StructuredReportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  recommendedAction: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  estimatedUrgency: z.string(),
  keyFindings: z.array(
    z.object({
      concept: z.string(),
      description: z.string(),
      severity: SeverityLevelSchema,
    })
  ).default([]),
});
export type StructuredReport = z.infer<typeof StructuredReportSchema>;

// --- Full Inspection Report Entity ---
export const InspectionReportSchema = z.object({
  id: z.string(),
  module: z.enum(["road", "construction"]),
  createdAt: z.string(),
  imageUrl: z.string(),
  afterImageUrl: z.string().optional(),
  imageWidth: z.number(),
  imageHeight: z.number(),
  afterImageWidth: z.number().optional(),
  afterImageHeight: z.number().optional(),
  location: GeoLocationSchema.optional(),
  sceneType: z.string(),
  overallCondition: z.string(),
  severityScore: z.number().min(0).max(100),
  severityLevel: SeverityLevelSchema,
  severityBreakdown: SeverityBreakdownSchema.optional(),
  findings: z.array(DamageFindingSchema),
  afterFindings: z.array(DamageFindingSchema).optional(),
  constructionDiff: ConstructionDiffSchema.optional(),
  title: z.string(),
  summary: z.string(),
  recommendedAction: z.string(),
  estimatedUrgency: z.string(),
  isCached: z.boolean().default(false),
  privacyBlurApplied: z.boolean().default(true),
  privacyRegionsBlurred: z.number().int().min(0).default(0),
  tokenUsage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  modelsUsed: z
    .object({
      vision: z.string(),
      segmentation: z.string(),
    })
    .optional(),
});
export type InspectionReport = z.infer<typeof InspectionReportSchema>;

// --- Default SAM Concepts (1-2 word plain nouns only) ---
export const DEFAULT_ROAD_CONCEPTS = [
  "pothole",
  "crack",
  "patch",
  "manhole cover",
] as const;

export const DEFAULT_CONSTRUCTION_CONCEPTS = [
  "scaffolding",
  "concrete wall",
  "excavator",
  "crack",
  "steel rebar",
  "debris",
] as const;

export const PRIVACY_CONCEPTS = ["person", "license plate"] as const;

export * from "./scoring.js";
export * from "./diff.js";
export * from "./filtering.js";

