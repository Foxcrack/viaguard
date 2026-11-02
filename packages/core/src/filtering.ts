import { BoundingBox, DamageFinding, DEFAULT_CONSTRUCTION_CONCEPTS } from "./index.js";

/** Minimum SAM 3.1 confidence threshold for "pothole" detections. */
export const POTHOLE_MIN_CONFIDENCE = 0.5;

/** Minimum SAM 3.1 confidence threshold for all non-pothole concepts. */
export const DEFAULT_MIN_CONFIDENCE = 0.6;

/** Cross-instance Non-Maximum Suppression IoU threshold (mask or box IoU > 0.5). */
export const NMS_IOU_THRESHOLD = 0.5;

/**
 * Minimum mask area ratio relative to total image area (`0.0015` = `0.15%` of frame).
 * SAM 3.1 masks smaller than 0.15% of the image area are discarded as unreliable speckle/distant noise.
 */
export const MIN_AREA_RATIO = 0.0015;

/** Confidence threshold used when segmenting privacy-sensitive regions ("person", "license plate"). */
export const PRIVACY_MIN_CONFIDENCE = 0.25;

const BANNED_CONCEPT_WORDS = new Set([
  // Adjectives, participles, and qualitative modifiers
  "cracked",
  "damaged",
  "broken",
  "worn",
  "faded",
  "peeling",
  "chipped",
  "eroded",
  "sunken",
  "collapsed",
  "exposed",
  "uneven",
  "rough",
  "loose",
  "standing",
  "wet",
  "dry",
  "deep",
  "shallow",
  "large",
  "small",
  "minor",
  "major",
  "severe",
  "critical",
  "heavy",
  "light",
  "old",
  "new",
  "fresh",
  "white",
  "yellow",
  "black",
  "dark",
  "painted",
  "visible",
  "scattered",
  "surrounding",
  "missing",
  "spalled",
  "rutted",
  // Non-damage background surfaces and paint markings that cause false-positive full-road masks
  "marking",
  "markings",
  "crosswalk",
  "stripe",
  "stripes",
  "paint",
  "line",
  "lines",
  "road",
  "street",
  "pavement",
  "asphalt",
  "surface",
  "lane",
  "sidewalk",
  "curb",
  "median",
  "intersection",
  "highway",
]);

const BANNED_CONCEPT_PHRASES = new Set([
  "road marking",
  "road markings",
  "road surface",
  "street surface",
  "white line",
  "yellow line",
  "crosswalk line",
  "pedestrian crossing",
]);

/** Legitimate construction/infrastructure plain nouns ending in -ing. */
const ALLOWED_ING_NOUNS = new Set([
  "scaffolding",
  "shoring",
  "piping",
  "fencing",
  "footing",
  "framing",
  "roofing",
  "railing",
  "cladding",
  "grating",
  "flooring",
  "ceiling",
]);

/** Legitimate plain nouns ending in -ed that are not past-participle adjectives. */
const ALLOWED_ED_NOUNS = new Set(["shed", "weed", "weeds"]);

export interface CandidateFinding extends DamageFinding {
  /** Optional transient binary raster (0/1) matching `maskBounds` for exact pixel-level mask IoU. */
  maskRaster?: Uint8Array;
}

/**
 * Validates and normalizes a single SAM concept string.
 * Returns the normalized 1-2 word lowercase plain noun, or `null` if invalid.
 */
export function sanitizeConcept(raw: string): string | null {
  if (typeof raw !== "string") return null;

  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;

  if (BANNED_CONCEPT_PHRASES.has(normalized)) {
    return null;
  }

  const words = normalized.split(" ");
  if (words.length === 0 || words.length > 2) {
    return null;
  }

  for (const word of words) {
    // Plain alphabetic words only
    if (!/^[a-z]+$/.test(word) || word.length < 2) {
      return null;
    }

    if (BANNED_CONCEPT_WORDS.has(word)) {
      return null;
    }

    // Reject past-participle adjectives (-ed), adverbs (-ly), and adjectival suffixes
    if (
      (word.endsWith("ed") && !ALLOWED_ED_NOUNS.has(word)) ||
      word.endsWith("ly") ||
      word.endsWith("ous") ||
      word.endsWith("ive") ||
      word.endsWith("able") ||
      word.endsWith("ible")
    ) {
      return null;
    }

    // Reject gerunds/participles (-ing) unless an explicit infrastructure noun like "scaffolding"
    if (word.endsWith("ing") && !ALLOWED_ING_NOUNS.has(word)) {
      return null;
    }
  }

  return normalized;
}

/**
 * Sanitizes a list of Muse Spark suggested concepts:
 * - Keeps only 1-2 word plain nouns (drops adjectives, 3+ word phrases, road markings, etc.).
 * - For `road`, ALWAYS includes `"pothole"` and `"crack"` in addition to sanitized suggestions.
 * - For `construction`, merges sanitized suggestions with `DEFAULT_CONSTRUCTION_CONCEPTS`.
 */
export function sanitizeConcepts(
  rawConcepts: readonly string[],
  moduleType: "road" | "construction",
  maxConcepts = moduleType === "road" ? 4 : 5
): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (c: string | null) => {
    if (!c || seen.has(c)) return;
    seen.add(c);
    cleaned.push(c);
  };

  if (moduleType === "road") {
    // Always guarantee "pothole" and "crack" are included for road inspections
    pushUnique("pothole");
    pushUnique("crack");
    for (const raw of rawConcepts) {
      pushUnique(sanitizeConcept(raw));
    }
  } else {
    for (const raw of rawConcepts) {
      pushUnique(sanitizeConcept(raw));
    }
    for (const def of DEFAULT_CONSTRUCTION_CONCEPTS) {
      pushUnique(sanitizeConcept(def));
    }
  }

  return cleaned.slice(0, maxConcepts);
}

/**
 * Returns the minimum confidence threshold for a given SAM concept:
 * `0.5` for `"pothole"`, `0.6` for all other concepts.
 */
export function getMinConfidenceForConcept(concept: string): number {
  return concept.trim().toLowerCase() === "pothole"
    ? POTHOLE_MIN_CONFIDENCE
    : DEFAULT_MIN_CONFIDENCE;
}

/**
 * Discards SAM detections below the per-concept confidence threshold.
 */
export function filterFindingsByConfidence<T extends DamageFinding>(findings: readonly T[]): T[] {
  return findings.filter((f) => f.confidence >= getMinConfidenceForConcept(f.concept));
}

/**
 * Discards SAM detections whose mask area is below `minAreaRatio` of total image area
 * (`MIN_AREA_RATIO = 0.0015`, i.e., `0.15%` of the frame).
 */
export function filterFindingsByMinArea<T extends DamageFinding>(
  findings: readonly T[],
  minAreaRatio = MIN_AREA_RATIO
): T[] {
  const minAreaPercent = minAreaRatio * 100;
  return findings.filter((f) => f.relativeAreaPercent >= minAreaPercent - 1e-9);
}

/**
 * Computes exact Intersection-over-Union (IoU) between two bounding boxes.
 */
export function computeBoxIoU(a: BoundingBox, b: BoundingBox): number {
  const interLeft = Math.max(a.x1, b.x1);
  const interTop = Math.max(a.y1, b.y1);
  const interRight = Math.min(a.x2, b.x2);
  const interBottom = Math.min(a.y2, b.y2);

  const interWidth = Math.max(0, interRight - interLeft);
  const interHeight = Math.max(0, interBottom - interTop);
  const interArea = interWidth * interHeight;
  if (interArea <= 0) return 0;

  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const unionArea = areaA + areaB - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Computes exact pixel-level mask IoU when both findings carry `maskRaster` and `maskBounds`.
 * Returns `null` if either finding lacks raster data.
 */
export function computeMaskIoU(a: CandidateFinding, b: CandidateFinding): number | null {
  if (!a.maskRaster || !b.maskRaster || !a.maskBounds || !b.maskBounds) {
    return null;
  }

  const widthA = a.maskBounds.right - a.maskBounds.left;
  const heightA = a.maskBounds.bottom - a.maskBounds.top;
  const widthB = b.maskBounds.right - b.maskBounds.left;
  const heightB = b.maskBounds.bottom - b.maskBounds.top;

  if (
    widthA <= 0 ||
    heightA <= 0 ||
    widthB <= 0 ||
    heightB <= 0 ||
    a.maskRaster.length !== widthA * heightA ||
    b.maskRaster.length !== widthB * heightB
  ) {
    return null;
  }

  const interLeft = Math.max(a.maskBounds.left, b.maskBounds.left);
  const interTop = Math.max(a.maskBounds.top, b.maskBounds.top);
  const interRight = Math.min(a.maskBounds.right, b.maskBounds.right);
  const interBottom = Math.min(a.maskBounds.bottom, b.maskBounds.bottom);

  let intersectionPixels = 0;
  if (interLeft < interRight && interTop < interBottom) {
    for (let y = interTop; y < interBottom; y++) {
      const rowOffsetA = (y - a.maskBounds.top) * widthA;
      const rowOffsetB = (y - b.maskBounds.top) * widthB;
      for (let x = interLeft; x < interRight; x++) {
        const valA = a.maskRaster[rowOffsetA + (x - a.maskBounds.left)];
        const valB = b.maskRaster[rowOffsetB + (x - b.maskBounds.left)];
        if (valA === 1 && valB === 1) {
          intersectionPixels++;
        }
      }
    }
  }

  let activeA = a.activePixels;
  if (activeA === undefined) {
    activeA = 0;
    for (let i = 0; i < a.maskRaster.length; i++) {
      if (a.maskRaster[i] === 1) activeA++;
    }
  }

  let activeB = b.activePixels;
  if (activeB === undefined) {
    activeB = 0;
    for (let i = 0; i < b.maskRaster.length; i++) {
      if (b.maskRaster[i] === 1) activeB++;
    }
  }

  const unionPixels = activeA + activeB - intersectionPixels;
  return unionPixels > 0 ? intersectionPixels / unionPixels : 0;
}

/**
 * Applies cross-instance Non-Maximum Suppression across ALL findings regardless of concept.
 * Sorts descending by confidence and suppresses any lower-confidence instance whose mask IoU
 * or bounding-box IoU with an already-kept instance exceeds `iouThreshold` (default `0.5`).
 */
export function deduplicateFindingsNMS(
  findings: readonly CandidateFinding[],
  iouThreshold = NMS_IOU_THRESHOLD
): DamageFinding[] {
  const sorted = [...findings].sort((a, b) => b.confidence - a.confidence);
  const kept: CandidateFinding[] = [];

  for (const candidate of sorted) {
    let suppressed = false;
    for (const existing of kept) {
      const maskIou = computeMaskIoU(existing, candidate);
      const boxIou = computeBoxIoU(existing.boundingBox, candidate.boundingBox);
      const effectiveIou = maskIou !== null ? Math.max(maskIou, boxIou) : boxIou;
      if (effectiveIou > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) {
      kept.push(candidate);
    }
  }

  // Strip transient maskRaster so persisted JSON reports remain compact
  return kept.map(({ maskRaster: _maskRaster, ...rest }) => rest);
}

/**
 * Full post-segmentation filter pipeline:
 * 1. Rejects findings whose concept is not a valid 1-2 word plain noun (unless disabled).
 * 2. Discards instances below confidence threshold (0.5 for pothole, 0.6 for all others).
 * 3. Discards instances whose mask area ratio is below MIN_AREA_RATIO (0.15% of frame).
 * 4. Runs cross-concept NMS (mask or box IoU > 0.5 keeps highest confidence).
 */
export function postProcessFindings(
  findings: readonly CandidateFinding[],
  options?: {
    enforcePlainNounConcepts?: boolean;
    minAreaRatio?: number;
    iouThreshold?: number;
  }
): DamageFinding[] {
  const enforceNouns = options?.enforcePlainNounConcepts ?? true;
  const sanitized = enforceNouns
    ? findings
        .map((f) => {
          const cleanConcept = sanitizeConcept(f.concept);
          return cleanConcept ? { ...f, concept: cleanConcept } : null;
        })
        .filter((f): f is CandidateFinding => f !== null)
    : [...findings];

  const confident = filterFindingsByConfidence(sanitized);
  const sizable = filterFindingsByMinArea(confident, options?.minAreaRatio ?? MIN_AREA_RATIO);
  return deduplicateFindingsNMS(sizable, options?.iouThreshold ?? NMS_IOU_THRESHOLD);
}
