import { DamageFinding, SeverityLevel } from "./index.js";

export const CONCEPT_WEIGHTS: Record<string, number> = {
  pothole: 1.4,
  "damaged road surface": 1.2,
  crack: 1.0,
  debris: 1.1,
  "steel rebar": 1.2,
  "manhole cover": 0.1, // Neutral reference element
};

export interface SeverityEvaluation {
  score: number; // 0 to 100
  level: SeverityLevel;
  totalDamageAreaPercent: number;
  damageInstanceCount: number;
  averageConfidence: number;
  dominantConcept: string;
}

/**
 * Computes deterministic severity score (0 to 100) and qualitative level
 * based on detected damage instances, relative mask area, confidence, and concept hazard weights.
 */
export function calculateSeverity(findings: DamageFinding[]): SeverityEvaluation {
  // Filter out neutral reference objects like manhole covers from damage calculations
  const damageFindings = findings.filter(
    (f) => f.concept.toLowerCase() !== "manhole cover"
  );

  if (damageFindings.length === 0) {
    return {
      score: 0,
      level: "low",
      totalDamageAreaPercent: 0,
      damageInstanceCount: 0,
      averageConfidence: 1.0,
      dominantConcept: "none",
    };
  }

  const damageInstanceCount = damageFindings.length;
  const totalDamageAreaPercent = damageFindings.reduce(
    (sum, f) => sum + f.relativeAreaPercent,
    0
  );

  const avgConfidence =
    damageFindings.reduce((sum, f) => sum + f.confidence, 0) /
    damageInstanceCount;

  // Max concept hazard weight
  let maxWeight = 1.0;
  let dominant = damageFindings[0].concept;

  for (const f of damageFindings) {
    const w = CONCEPT_WEIGHTS[f.concept.toLowerCase()] ?? 1.0;
    if (w > maxWeight) {
      maxWeight = w;
      dominant = f.concept;
    }
  }

  // Component 1: Area score (up to 50 points)
  // 15% frame coverage of potholes/damage is already very severe in municipal inspection
  const areaScore = Math.min(totalDamageAreaPercent * 3.33, 50);

  // Component 2: Instance count score (up to 30 points)
  // 4 or more distinct damage patches = 30 points
  const countScore = Math.min(damageInstanceCount * 7.5, 30);

  // Component 3: Baseline hazard multiplier
  const confidenceMultiplier = 0.7 + 0.3 * Math.min(Math.max(avgConfidence, 0), 1);
  const hazardFactor = maxWeight / 1.2;

  const rawScore = (areaScore + countScore + 5) * confidenceMultiplier * hazardFactor;
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

  return {
    score,
    level,
    totalDamageAreaPercent: Number(totalDamageAreaPercent.toFixed(2)),
    damageInstanceCount,
    averageConfidence: Number(avgConfidence.toFixed(2)),
    dominantConcept: dominant,
  };
}
