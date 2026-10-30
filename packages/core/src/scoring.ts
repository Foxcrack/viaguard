import { DamageFinding, SeverityBreakdown, SeverityLevel } from "./index.js";

/**
 * Per-concept hazard weight multipliers.
 * Neutral utility fixtures (`manhole cover`) have weight `0` and are excluded from damage scoring.
 */
export const CONCEPT_WEIGHTS: Record<string, number> = {
  sinkhole: 1.5,
  pothole: 1.3,
  "steel rebar": 1.2,
  rebar: 1.2,
  debris: 1.1,
  rut: 1.1,
  spall: 1.1,
  crack: 1.0,
  patch: 0.7,
  puddle: 0.6,
  "manhole cover": 0,
};

/** Points awarded per 1% of confidence- and type-weighted total damaged area. */
export const TOTAL_AREA_SCORE_FACTOR = 4.5;

/** Maximum points contributed by total damaged area (dominant term #1). */
export const MAX_TOTAL_AREA_SCORE = 50;

/** Points awarded per 1% of confidence- and type-weighted largest single defect area. */
export const LARGEST_INSTANCE_SCORE_FACTOR = 5.0;

/** Maximum points contributed by the largest single defect area (dominant term #2). */
export const MAX_LARGEST_INSTANCE_SCORE = 40;

/** Confidence-weighted bonus points per detected damage instance (`1.25 * confidence`). */
export const COUNT_BONUS_PER_INSTANCE = 1.25;

/** Maximum bonus points contributed by instance count (`+10` cap). */
export const MAX_COUNT_BONUS = 10;

export interface SeverityEvaluation {
  score: number; // 0 to 100
  level: SeverityLevel;
  totalDamageAreaPercent: number;
  largestInstanceAreaPercent: number;
  damageInstanceCount: number;
  averageConfidence: number;
  dominantConcept: string;
  breakdown: SeverityBreakdown;
}

/**
 * Computes deterministic severity score (0 to 100), qualitative level, and full score breakdown.
 *
 * Design principles:
 * - Each instance `i` contributes effective weighted area `e_i = area_i * confidence_i * typeWeight_i`.
 * - Dominant factors are Total Damaged Area (`totalAreaScore`, max 50) and Largest Single Instance Area
 *   (`largestInstanceScore`, max 40), accounting for 90% of the 100-point scale.
 * - Instance count contributes only a small confidence-weighted bonus (`countBonus`, max +10).
 */
export function calculateSeverity(findings: DamageFinding[]): SeverityEvaluation {
  const damageFindings = findings.filter((f) => {
    const key = f.concept.trim().toLowerCase();
    const w = CONCEPT_WEIGHTS[key] ?? 1.0;
    return w > 0 && f.relativeAreaPercent > 0;
  });

  if (damageFindings.length === 0) {
    const emptyBreakdown: SeverityBreakdown = {
      rawTotalAreaPercent: 0,
      largestInstanceRawAreaPercent: 0,
      weightedTotalArea: 0,
      largestInstanceWeightedArea: 0,
      totalAreaScore: 0,
      largestInstanceScore: 0,
      countBonus: 0,
      damageInstanceCount: 0,
      averageConfidence: 0,
      appliedTypeWeights: {},
      rawScore: 0,
      finalScore: 0,
    };

    return {
      score: 0,
      level: "low",
      totalDamageAreaPercent: 0,
      largestInstanceAreaPercent: 0,
      damageInstanceCount: 0,
      averageConfidence: 0,
      dominantConcept: "none",
      breakdown: emptyBreakdown,
    };
  }

  const damageInstanceCount = damageFindings.length;
  let rawTotalAreaPercent = 0;
  let largestInstanceRawAreaPercent = 0;
  let weightedTotalArea = 0;
  let largestInstanceWeightedArea = 0;
  let confidenceSum = 0;
  let dominantConcept = damageFindings[0].concept;
  let dominantContribution = -1;
  const appliedTypeWeights: Record<string, number> = {};

  for (const f of damageFindings) {
    const conceptKey = f.concept.trim().toLowerCase();
    const typeWeight = CONCEPT_WEIGHTS[conceptKey] ?? 1.0;
    const clampedConf = Math.min(Math.max(f.confidence, 0), 1);
    const area = Math.max(0, f.relativeAreaPercent);
    const effectiveArea = area * clampedConf * typeWeight;

    appliedTypeWeights[conceptKey] = typeWeight;
    rawTotalAreaPercent += area;
    if (area > largestInstanceRawAreaPercent) {
      largestInstanceRawAreaPercent = area;
    }

    weightedTotalArea += effectiveArea;
    if (effectiveArea > largestInstanceWeightedArea) {
      largestInstanceWeightedArea = effectiveArea;
    }

    if (effectiveArea > dominantContribution) {
      dominantContribution = effectiveArea;
      dominantConcept = f.concept;
    }

    confidenceSum += clampedConf;
  }

  const avgConfidence = confidenceSum / damageInstanceCount;

  const totalAreaScore = Math.min(
    MAX_TOTAL_AREA_SCORE,
    weightedTotalArea * TOTAL_AREA_SCORE_FACTOR
  );

  const largestInstanceScore = Math.min(
    MAX_LARGEST_INSTANCE_SCORE,
    largestInstanceWeightedArea * LARGEST_INSTANCE_SCORE_FACTOR
  );

  const countBonus = Math.min(
    MAX_COUNT_BONUS,
    confidenceSum * COUNT_BONUS_PER_INSTANCE
  );

  const rawScore = totalAreaScore + largestInstanceScore + countBonus;
  const score = Math.round(Math.min(Math.max(rawScore, 0), 100));

  let level: SeverityLevel = "low";
  if (score >= 80) {
    level = "critical";
  } else if (score >= 55) {
    level = "high";
  } else if (score >= 25) {
    level = "medium";
  } else {
    level = "low";
  }

  const breakdown: SeverityBreakdown = {
    rawTotalAreaPercent: Number(rawTotalAreaPercent.toFixed(2)),
    largestInstanceRawAreaPercent: Number(largestInstanceRawAreaPercent.toFixed(2)),
    weightedTotalArea: Number(weightedTotalArea.toFixed(2)),
    largestInstanceWeightedArea: Number(largestInstanceWeightedArea.toFixed(2)),
    totalAreaScore: Number(totalAreaScore.toFixed(2)),
    largestInstanceScore: Number(largestInstanceScore.toFixed(2)),
    countBonus: Number(countBonus.toFixed(2)),
    damageInstanceCount,
    averageConfidence: Number(avgConfidence.toFixed(2)),
    appliedTypeWeights,
    rawScore: Number(rawScore.toFixed(2)),
    finalScore: score,
  };

  return {
    score,
    level,
    totalDamageAreaPercent: breakdown.rawTotalAreaPercent,
    largestInstanceAreaPercent: breakdown.largestInstanceRawAreaPercent,
    damageInstanceCount,
    averageConfidence: breakdown.averageConfidence,
    dominantConcept,
    breakdown,
  };
}
