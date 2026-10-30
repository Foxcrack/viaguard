import { ConstructionDiff, ConceptDiff, DamageFinding } from "./index.js";

const NEGATIVE_CONCEPTS = new Set(["crack", "debris", "damaged road surface", "pothole"]);

/**
 * Computes exact quantitative differences between BEFORE and AFTER inspection findings
 * for a fixed set of concepts.
 */
export function compareConstructionSites(
  beforeFindings: DamageFinding[],
  afterFindings: DamageFinding[],
  concepts: readonly string[]
): ConstructionDiff {
  const conceptSet = new Set([
    ...concepts,
    ...beforeFindings.map((f) => f.concept),
    ...afterFindings.map((f) => f.concept),
  ]);

  const conceptChanges: ConceptDiff[] = [];
  let positiveScore = 0;
  let negativeScore = 0;

  for (const concept of conceptSet) {
    const beforeInstances = beforeFindings.filter(
      (f) => f.concept.toLowerCase() === concept.toLowerCase()
    );
    const afterInstances = afterFindings.filter(
      (f) => f.concept.toLowerCase() === concept.toLowerCase()
    );

    const beforeCount = beforeInstances.length;
    const afterCount = afterInstances.length;
    const deltaCount = afterCount - beforeCount;

    const beforeAreaPercent = Number(
      beforeInstances
        .reduce((sum, f) => sum + f.relativeAreaPercent, 0)
        .toFixed(2)
    );
    const afterAreaPercent = Number(
      afterInstances
        .reduce((sum, f) => sum + f.relativeAreaPercent, 0)
        .toFixed(2)
    );
    const deltaAreaPercent = Number(
      (afterAreaPercent - beforeAreaPercent).toFixed(2)
    );

    const isNegative = NEGATIVE_CONCEPTS.has(concept.toLowerCase());

    let status: "progress" | "deterioration" | "stable" = "stable";

    if (Math.abs(deltaAreaPercent) >= 0.2 || deltaCount !== 0) {
      if (isNegative) {
        // More debris or cracks = deterioration; fewer = progress
        status = deltaAreaPercent > 0 || deltaCount > 0 ? "deterioration" : "progress";
      } else {
        // More structural elements (concrete wall, rebar, scaffolding) = progress
        status = deltaAreaPercent > 0 || deltaCount > 0 ? "progress" : "stable";
      }
    }

    if (status === "progress") {
      positiveScore += Math.abs(deltaAreaPercent) * 2 + Math.abs(deltaCount) * 10;
    } else if (status === "deterioration") {
      negativeScore += Math.abs(deltaAreaPercent) * 3 + Math.abs(deltaCount) * 15;
    }

    conceptChanges.push({
      concept,
      beforeCount,
      afterCount,
      deltaCount,
      beforeAreaPercent,
      afterAreaPercent,
      deltaAreaPercent,
      status,
    });
  }

  // Calculate net progress score clamped between -100 and +100
  const netScore = Math.round(
    Math.min(Math.max(positiveScore - negativeScore, -100), 100)
  );

  let overallAssessment = "Site activity is stable with minor observable variance.";
  if (netScore >= 20) {
    overallAssessment = `Observable structural progression measured across ${
      conceptChanges.filter((c) => c.status === "progress").length
    } target element(s).`;
  } else if (netScore <= -15) {
    overallAssessment = `Elevated degradation or debris accumulation detected across ${
      conceptChanges.filter((c) => c.status === "deterioration").length
    } element(s).`;
  }

  return {
    conceptChanges,
    overallAssessment,
    progressScore: netScore,
  };
}

