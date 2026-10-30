import { describe, it, expect } from "vitest";
import { calculateSeverity } from "../src/scoring.js";
import { DamageFinding } from "../src/index.js";

describe("calculateSeverity", () => {
  it("returns score 0 and low level when no damage findings are detected", () => {
    const result = calculateSeverity([]);
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
    expect(result.totalDamageAreaPercent).toBe(0);
    expect(result.damageInstanceCount).toBe(0);
    expect(result.dominantConcept).toBe("none");
  });

  it("ignores neutral manhole covers in damage severity calculation", () => {
    const findings: DamageFinding[] = [
      {
        id: "manhole-1",
        concept: "manhole cover",
        confidence: 0.95,
        relativeAreaPercent: 3.5,
        boundingBox: { x1: 50, y1: 50, x2: 150, y2: 150, width: 100, height: 100 },
      },
    ];
    const result = calculateSeverity(findings);
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
    expect(result.damageInstanceCount).toBe(0);
  });

  it("calculates low or medium severity for a minor hairline crack", () => {
    const findings: DamageFinding[] = [
      {
        id: "crack-1",
        concept: "crack",
        confidence: 0.85,
        relativeAreaPercent: 0.45, // very small relative area
        boundingBox: { x1: 10, y1: 20, x2: 60, y2: 25, width: 50, height: 5 },
      },
    ];
    const result = calculateSeverity(findings);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(35);
    expect(["low", "medium"]).toContain(result.level);
    expect(result.dominantConcept).toBe("crack");
  });

  it("evaluates significant potholes as high or critical severity", () => {
    const findings: DamageFinding[] = [
      {
        id: "pothole-1",
        concept: "pothole",
        confidence: 0.92,
        relativeAreaPercent: 12.0, // large hazardous pothole
        boundingBox: { x1: 100, y1: 150, x2: 450, y2: 400, width: 350, height: 250 },
      },
      {
        id: "surface-1",
        concept: "damaged road surface",
        confidence: 0.88,
        relativeAreaPercent: 8.5,
        boundingBox: { x1: 80, y1: 130, x2: 480, y2: 420, width: 400, height: 290 },
      },
    ];
    const result = calculateSeverity(findings);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(["high", "critical"]).toContain(result.level);
    expect(result.dominantConcept).toBe("pothole");
  });

  it("properly clamps severity scores between 0 and 100 even with extreme areas", () => {
    const findings: DamageFinding[] = Array.from({ length: 15 }, (_, i) => ({
      id: `pothole-${i}`,
      concept: "pothole",
      confidence: 0.99,
      relativeAreaPercent: 20.0,
      boundingBox: { x1: 0, y1: 0, x2: 500, y2: 500, width: 500, height: 500 },
    }));
    const result = calculateSeverity(findings);
    expect(result.score).toBe(100);
    expect(result.level).toBe("critical");
  });
});

