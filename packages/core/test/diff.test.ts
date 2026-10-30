import { describe, it, expect } from "vitest";
import { compareConstructionSites } from "../src/diff.js";
import { DamageFinding } from "../src/index.js";

describe("compareConstructionSites", () => {
  const concepts = ["scaffolding", "concrete wall", "crack", "debris"] as const;

  it("detects construction progression when structural elements increase", () => {
    const beforeFindings: DamageFinding[] = [
      {
        id: "scaffold-1",
        concept: "scaffolding",
        confidence: 0.9,
        relativeAreaPercent: 5.0,
        boundingBox: { x1: 0, y1: 0, x2: 100, y2: 100, width: 100, height: 100 },
      },
    ];

    const afterFindings: DamageFinding[] = [
      {
        id: "scaffold-1",
        concept: "scaffolding",
        confidence: 0.9,
        relativeAreaPercent: 8.0,
        boundingBox: { x1: 0, y1: 0, x2: 150, y2: 150, width: 150, height: 150 },
      },
      {
        id: "wall-1",
        concept: "concrete wall",
        confidence: 0.95,
        relativeAreaPercent: 14.5,
        boundingBox: { x1: 100, y1: 100, x2: 300, y2: 400, width: 200, height: 300 },
      },
    ];

    const result = compareConstructionSites(beforeFindings, afterFindings, concepts);
    expect(result.progressScore).toBeGreaterThan(0);
    const wallChange = result.conceptChanges.find((c) => c.concept === "concrete wall");
    expect(wallChange).toBeDefined();
    expect(wallChange?.status).toBe("progress");
    expect(wallChange?.deltaCount).toBe(1);
    expect(wallChange?.deltaAreaPercent).toBe(14.5);
  });

  it("detects site deterioration when debris or cracks accumulate", () => {
    const beforeFindings: DamageFinding[] = [];
    const afterFindings: DamageFinding[] = [
      {
        id: "crack-1",
        concept: "crack",
        confidence: 0.88,
        relativeAreaPercent: 2.5,
        boundingBox: { x1: 10, y1: 10, x2: 50, y2: 50, width: 40, height: 40 },
      },
      {
        id: "debris-1",
        concept: "debris",
        confidence: 0.91,
        relativeAreaPercent: 6.0,
        boundingBox: { x1: 100, y1: 100, x2: 250, y2: 250, width: 150, height: 150 },
      },
    ];

    const result = compareConstructionSites(beforeFindings, afterFindings, concepts);
    expect(result.progressScore).toBeLessThan(0);
    const debrisChange = result.conceptChanges.find((c) => c.concept === "debris");
    expect(debrisChange?.status).toBe("deterioration");
  });

  it("marks status as stable when before and after findings are identical", () => {
    const findings: DamageFinding[] = [
      {
        id: "wall-1",
        concept: "concrete wall",
        confidence: 0.9,
        relativeAreaPercent: 10.0,
        boundingBox: { x1: 0, y1: 0, x2: 100, y2: 100, width: 100, height: 100 },
      },
    ];

    const result = compareConstructionSites(findings, findings, concepts);
    expect(result.progressScore).toBe(0);
    const wallChange = result.conceptChanges.find((c) => c.concept === "concrete wall");
    expect(wallChange?.status).toBe("stable");
    expect(wallChange?.deltaCount).toBe(0);
    expect(wallChange?.deltaAreaPercent).toBe(0);
  });
});

