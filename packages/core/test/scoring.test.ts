import { describe, it, expect } from "vitest";
import {
  calculateSeverity,
  TOTAL_AREA_SCORE_FACTOR,
  MAX_TOTAL_AREA_SCORE,
  LARGEST_INSTANCE_SCORE_FACTOR,
  MAX_LARGEST_INSTANCE_SCORE,
  COUNT_BONUS_PER_INSTANCE,
  MAX_COUNT_BONUS,
} from "../src/scoring.js";
import { DamageFinding, postProcessFindings } from "../src/index.js";

const dummyBox = { x1: 10, y1: 10, x2: 110, y2: 110, width: 100, height: 100 };

describe("calculateSeverity (area + largest-instance dominant formula)", () => {
  it("exports documented scoring constants", () => {
    expect(TOTAL_AREA_SCORE_FACTOR).toBe(4.5);
    expect(MAX_TOTAL_AREA_SCORE).toBe(50);
    expect(LARGEST_INSTANCE_SCORE_FACTOR).toBe(5.0);
    expect(MAX_LARGEST_INSTANCE_SCORE).toBe(40);
    expect(COUNT_BONUS_PER_INSTANCE).toBe(1.25);
    expect(MAX_COUNT_BONUS).toBe(10);
  });

  it("returns score 0 and zeroed breakdown when no damage findings are detected", () => {
    const result = calculateSeverity([]);
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
    expect(result.totalDamageAreaPercent).toBe(0);
    expect(result.largestInstanceAreaPercent).toBe(0);
    expect(result.damageInstanceCount).toBe(0);
    expect(result.dominantConcept).toBe("none");
    expect(result.breakdown).toEqual({
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
    });
  });

  it("ignores neutral manhole covers and positive construction elements (weight 0) in hazard severity calculation", () => {
    const findings: DamageFinding[] = [
      {
        id: "manhole-1",
        concept: "manhole cover",
        confidence: 0.95,
        relativeAreaPercent: 3.5,
        boundingBox: dummyBox,
      },
      {
        id: "wall-1",
        concept: "concrete wall",
        confidence: 0.92,
        relativeAreaPercent: 18.0,
        boundingBox: dummyBox,
      },
      {
        id: "scaffold-1",
        concept: "scaffolding",
        confidence: 0.89,
        relativeAreaPercent: 11.5,
        boundingBox: dummyBox,
      },
    ];
    const result = calculateSeverity(findings);
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
    expect(result.damageInstanceCount).toBe(0);
  });

  it("scores Photo A (1 large pothole 6.72%, 69% conf) higher than Photo B (8 tiny potholes 0.08%-0.95%, ~3.9% total)", () => {
    const photoA: DamageFinding[] = [
      {
        id: "photo-a-pothole",
        concept: "pothole",
        confidence: 0.69,
        relativeAreaPercent: 6.72,
        boundingBox: { x1: 419, y1: 627, x2: 1069, y2: 1023, width: 650, height: 396 },
      },
    ];

    // Photo B: 8 small potholes ranging from 0.08% to 0.95% totaling ~3.9% of frame
    const photoB: DamageFinding[] = [
      { id: "b-1", concept: "pothole", confidence: 0.8, relativeAreaPercent: 0.95, boundingBox: dummyBox },
      { id: "b-2", concept: "pothole", confidence: 0.84, relativeAreaPercent: 0.78, boundingBox: dummyBox },
      { id: "b-3", concept: "pothole", confidence: 0.84, relativeAreaPercent: 0.68, boundingBox: dummyBox },
      { id: "b-4", concept: "pothole", confidence: 0.75, relativeAreaPercent: 0.55, boundingBox: dummyBox },
      { id: "b-5", concept: "pothole", confidence: 0.72, relativeAreaPercent: 0.35, boundingBox: dummyBox },
      { id: "b-6", concept: "pothole", confidence: 0.7, relativeAreaPercent: 0.28, boundingBox: dummyBox },
      { id: "b-7", concept: "pothole", confidence: 0.66, relativeAreaPercent: 0.23, boundingBox: dummyBox },
      { id: "b-8", concept: "pothole", confidence: 0.54, relativeAreaPercent: 0.08, boundingBox: dummyBox },
    ];

    const evalA = calculateSeverity(photoA);
    const evalB = calculateSeverity(photoB);

    // Photo A: 1 large pothole (6.72%) -> high severity (58/100)
    expect(evalA.score).toBe(58);
    expect(evalA.level).toBe("high");
    expect(evalA.breakdown.totalAreaScore).toBeCloseTo(27.13, 1);
    expect(evalA.breakdown.largestInstanceScore).toBeCloseTo(30.14, 1);
    expect(evalA.breakdown.countBonus).toBeCloseTo(0.86, 1);
    expect(evalA.breakdown.appliedTypeWeights).toEqual({ pothole: 1.3 });

    // Photo B: 8 tiny potholes (~3.9% total, max 0.95%) -> medium severity (31/100), count bonus capped <= 10
    expect(evalB.breakdown.rawTotalAreaPercent).toBeCloseTo(3.9, 2);
    expect(evalB.breakdown.largestInstanceRawAreaPercent).toBe(0.95);
    expect(evalB.breakdown.countBonus).toBeLessThanOrEqual(10);
    expect(evalB.score).toBeLessThan(evalA.score);
    expect(evalB.level).toBe("medium");
  });

  it("enforces sensible ordering: 1 huge pothole >= 3 medium potholes > 10 tiny dots > no damage (0)", () => {
    const noDamage = calculateSeverity([]);

    const tenTinyDots = calculateSeverity(
      Array.from({ length: 10 }, (_, i) => ({
        id: `tiny-${i}`,
        concept: "pothole",
        confidence: 0.7,
        relativeAreaPercent: 0.2, // 10 * 0.2% = 2.0% total, max 0.2%
        boundingBox: dummyBox,
      }))
    );

    const threeMediumPotholes = calculateSeverity(
      Array.from({ length: 3 }, (_, i) => ({
        id: `med-${i}`,
        concept: "pothole",
        confidence: 0.82,
        relativeAreaPercent: 2.5, // 3 * 2.5% = 7.5% total, max 2.5%
        boundingBox: dummyBox,
      }))
    );

    const oneHugePothole = calculateSeverity([
      {
        id: "huge-1",
        concept: "pothole",
        confidence: 0.88,
        relativeAreaPercent: 11.0, // 11% single void
        boundingBox: dummyBox,
      },
    ]);

    // Also verify at equal total area (7.5% single vs 3 x 2.5% = 7.5%)
    const singleEqualTotal = calculateSeverity([
      {
        id: "single-75",
        concept: "pothole",
        confidence: 0.82,
        relativeAreaPercent: 7.5,
        boundingBox: dummyBox,
      },
    ]);

    expect(noDamage.score).toBe(0);
    expect(tenTinyDots.score).toBeGreaterThan(noDamage.score);
    expect(tenTinyDots.breakdown.countBonus).toBeLessThanOrEqual(10);
    expect(threeMediumPotholes.score).toBeGreaterThan(tenTinyDots.score);
    expect(oneHugePothole.score).toBeGreaterThanOrEqual(threeMediumPotholes.score);
    expect(singleEqualTotal.score).toBeGreaterThanOrEqual(threeMediumPotholes.score);
  });

  it("properly clamps severity scores between 0 and 100 even with extreme areas", () => {
    const findings: DamageFinding[] = Array.from({ length: 15 }, (_, i) => ({
      id: `pothole-${i}`,
      concept: "pothole",
      confidence: 0.99,
      relativeAreaPercent: 20.0,
      boundingBox: dummyBox,
    }));
    const result = calculateSeverity(findings);
    expect(result.score).toBe(100);
    expect(result.level).toBe("critical");
  });

  it("recomputes severity using only filtered instances on the three-detection real-photo example", () => {
    const rawDetections: DamageFinding[] = [
      {
        id: "finding-pothole-0",
        concept: "pothole",
        confidence: 0.69,
        relativeAreaPercent: 6.73,
        boundingBox: { x1: 419, y1: 627, x2: 1069, y2: 1023, width: 650, height: 396 },
      },
      {
        id: "finding-cracked-marking-0",
        concept: "cracked road marking",
        confidence: 0.55,
        relativeAreaPercent: 4.2,
        boundingBox: { x1: 46, y1: 394, x2: 1195, y2: 770, width: 1149, height: 376 },
      },
      {
        id: "finding-cracked-marking-1",
        concept: "cracked road marking",
        confidence: 0.6,
        relativeAreaPercent: 3.67,
        boundingBox: { x1: 0, y1: 765, x2: 1117, y2: 1398, width: 1117, height: 633 },
      },
    ];

    const unfilteredEval = calculateSeverity(rawDetections);
    const filtered = postProcessFindings(rawDetections);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].concept).toBe("pothole");

    const filteredEval = calculateSeverity(filtered);
    expect(filteredEval.damageInstanceCount).toBe(1);
    expect(filteredEval.score).toBeLessThan(unfilteredEval.score);
    expect(filteredEval.score).toBe(58);
    expect(filteredEval.level).toBe("high");
  });
});
