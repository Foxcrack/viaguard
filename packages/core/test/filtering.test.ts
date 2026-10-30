import { describe, it, expect } from "vitest";
import {
  POTHOLE_MIN_CONFIDENCE,
  DEFAULT_MIN_CONFIDENCE,
  NMS_IOU_THRESHOLD,
  MIN_AREA_RATIO,
  sanitizeConcept,
  sanitizeConcepts,
  filterFindingsByConfidence,
  filterFindingsByMinArea,
  computeBoxIoU,
  computeMaskIoU,
  deduplicateFindingsNMS,
  postProcessFindings,
  CandidateFinding,
} from "../src/index.js";

describe("Concept Sanitizing", () => {
  it("accepts 1- or 2-word plain nouns", () => {
    expect(sanitizeConcept("pothole")).toBe("pothole");
    expect(sanitizeConcept("  Crack ")).toBe("crack");
    expect(sanitizeConcept("patch")).toBe("patch");
    expect(sanitizeConcept("manhole cover")).toBe("manhole cover");
    expect(sanitizeConcept("scaffolding")).toBe("scaffolding");
    expect(sanitizeConcept("concrete wall")).toBe("concrete wall");
  });

  it("rejects concepts longer than 2 words or containing adjectives / markings", () => {
    expect(sanitizeConcept("cracked road marking")).toBeNull();
    expect(sanitizeConcept("damaged road surface")).toBeNull();
    expect(sanitizeConcept("road marking")).toBeNull();
    expect(sanitizeConcept("cracked asphalt")).toBeNull();
    expect(sanitizeConcept("peeling paint")).toBeNull();
    expect(sanitizeConcept("broken curb")).toBeNull();
    expect(sanitizeConcept("crosswalk")).toBeNull();
    expect(sanitizeConcept("asphalt")).toBeNull();
  });

  it("always includes 'pothole' and 'crack' for road inspections and drops invalid concepts", () => {
    const result = sanitizeConcepts(
      ["cracked road marking", "damaged road surface", "patch", "manhole cover"],
      "road"
    );
    expect(result).toContain("pothole");
    expect(result).toContain("crack");
    expect(result).toEqual(["pothole", "crack", "patch", "manhole cover"]);
  });
});

describe("Confidence Threshold Filtering", () => {
  it("exports documented threshold constants (0.5 pothole, 0.6 others, 0.5 NMS IoU, 0.0015 min area ratio)", () => {
    expect(POTHOLE_MIN_CONFIDENCE).toBe(0.5);
    expect(DEFAULT_MIN_CONFIDENCE).toBe(0.6);
    expect(NMS_IOU_THRESHOLD).toBe(0.5);
    expect(MIN_AREA_RATIO).toBe(0.0015);
  });

  it("discards pothole < 0.5 and other concepts < 0.6", () => {
    const items: CandidateFinding[] = [
      {
        id: "p-low",
        concept: "pothole",
        confidence: 0.49,
        relativeAreaPercent: 3.0,
        boundingBox: { x1: 0, y1: 0, x2: 50, y2: 50, width: 50, height: 50 },
      },
      {
        id: "p-ok",
        concept: "pothole",
        confidence: 0.5,
        relativeAreaPercent: 4.5,
        boundingBox: { x1: 100, y1: 100, x2: 200, y2: 200, width: 100, height: 100 },
      },
      {
        id: "c-low",
        concept: "crack",
        confidence: 0.55,
        relativeAreaPercent: 2.1,
        boundingBox: { x1: 250, y1: 250, x2: 350, y2: 270, width: 100, height: 20 },
      },
      {
        id: "c-ok",
        concept: "crack",
        confidence: 0.6,
        relativeAreaPercent: 1.8,
        boundingBox: { x1: 400, y1: 400, x2: 500, y2: 420, width: 100, height: 20 },
      },
    ];

    const kept = filterFindingsByConfidence(items);
    expect(kept.map((f) => f.id)).toEqual(["p-ok", "c-ok"]);
  });
});

describe("Cross-Concept Non-Maximum Suppression (NMS)", () => {
  it("suppresses overlapping bounding boxes across concepts when IoU > 0.5 and keeps highest confidence", () => {
    const findings: CandidateFinding[] = [
      {
        id: "patch-lower",
        concept: "patch",
        confidence: 0.64,
        relativeAreaPercent: 6.2,
        boundingBox: { x1: 100, y1: 100, x2: 300, y2: 300, width: 200, height: 200 },
      },
      {
        id: "pothole-higher",
        concept: "pothole",
        confidence: 0.85,
        relativeAreaPercent: 6.5,
        boundingBox: { x1: 110, y1: 110, x2: 305, y2: 305, width: 195, height: 195 },
      },
      {
        id: "crack-separate",
        concept: "crack",
        confidence: 0.72,
        relativeAreaPercent: 1.4,
        boundingBox: { x1: 500, y1: 500, x2: 650, y2: 530, width: 150, height: 30 },
      },
    ];

    expect(
      computeBoxIoU(findings[0].boundingBox, findings[1].boundingBox)
    ).toBeGreaterThan(0.5);

    const deduped = deduplicateFindingsNMS(findings);
    expect(deduped.map((f) => f.id)).toEqual(["pothole-higher", "crack-separate"]);
  });

  it("computes pixel-level mask IoU and suppresses duplicate masks > 0.5 while stripping transient rasters", () => {
    // 10x10 masks at identical bounds
    const fullMask = new Uint8Array(100).fill(1);
    const eightRowsMask = new Uint8Array(100);
    eightRowsMask.fill(1, 0, 80); // 80/100 overlap -> mask IoU = 0.8 > 0.5

    const a: CandidateFinding = {
      id: "mask-high",
      concept: "pothole",
      confidence: 0.78,
      relativeAreaPercent: 5.0,
      boundingBox: { x1: 0, y1: 0, x2: 10, y2: 10, width: 10, height: 10 },
      maskBounds: { left: 0, top: 0, right: 10, bottom: 10 },
      activePixels: 100,
      maskRaster: fullMask,
    };

    const b: CandidateFinding = {
      id: "mask-low",
      concept: "crack",
      confidence: 0.65,
      relativeAreaPercent: 4.0,
      boundingBox: { x1: 0, y1: 0, x2: 20, y2: 10, width: 20, height: 10 }, // box IoU = 0.5 (not > 0.5), but mask IoU = 0.8!
      maskBounds: { left: 0, top: 0, right: 10, bottom: 10 },
      activePixels: 80,
      maskRaster: eightRowsMask,
    };

    expect(computeMaskIoU(a, b)).toBeCloseTo(0.8, 5);
    const deduped = deduplicateFindingsNMS([b, a]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe("mask-high");
    expect((deduped[0] as CandidateFinding).maskRaster).toBeUndefined();
  });
});

describe("Minimum Instance Size Filtering (MIN_AREA_RATIO = 0.0015 / 0.15%)", () => {
  it("discards masks below 0.15% of image area and retains masks >= 0.15%", () => {
    const items: CandidateFinding[] = [
      {
        id: "speck-008",
        concept: "pothole",
        confidence: 0.54,
        relativeAreaPercent: 0.08, // < 0.15% -> discard
        boundingBox: { x1: 2, y1: 181, x2: 40, y2: 188, width: 38, height: 7 },
      },
      {
        id: "speck-013",
        concept: "pothole",
        confidence: 0.66,
        relativeAreaPercent: 0.13, // < 0.15% -> discard
        boundingBox: { x1: 49, y1: 212, x2: 86, y2: 221, width: 37, height: 9 },
      },
      {
        id: "edge-015",
        concept: "pothole",
        confidence: 0.7,
        relativeAreaPercent: 0.15, // == 0.15% -> keep
        boundingBox: { x1: 100, y1: 180, x2: 140, y2: 195, width: 40, height: 15 },
      },
      {
        id: "valid-095",
        concept: "pothole",
        confidence: 0.8,
        relativeAreaPercent: 0.95, // > 0.15% -> keep
        boundingBox: { x1: 305, y1: 247, x2: 394, y2: 273, width: 89, height: 26 },
      },
    ];

    expect(filterFindingsByMinArea(items).map((f) => f.id)).toEqual([
      "edge-015",
      "valid-095",
    ]);

    const processed = postProcessFindings(items);
    expect(processed.map((f) => f.id)).toEqual(["valid-095", "edge-015"]);
  });
});

