import { loadEnv } from "./paths.js";
loadEnv();

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import {
  sanitizeConcepts,
  postProcessFindings,
  calculateSeverity,
  getMinConfidenceForConcept,
  MIN_AREA_RATIO,
  computeBoxIoU,
  computeMaskIoU,
  CandidateFinding,
  DamageFinding,
} from "@viaguard/core";
import { understandSceneWithMuseSpark, segmentConceptWithSAM } from "./meta-client.js";

function findRootPath(subpath: string): string {
  const try1 = path.resolve(process.cwd(), subpath);
  if (fs.existsSync(try1)) return try1;
  const try2 = path.resolve(process.cwd(), "../..", subpath);
  if (fs.existsSync(try2)) return try2;
  return path.resolve(process.cwd(), subpath);
}

const MY_PHOTOS_DIR = findRootPath("my-photos");
const MANIFEST_PATH = path.join(MY_PHOTOS_DIR, "manifest.json");
const GROUND_TRUTH_PATH = path.join(MY_PHOTOS_DIR, "ground-truth.csv");
const CACHE_DIR = findRootPath(".cache/eval");

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface ManifestItem {
  filename: string;
  hash: string;
  width: number | null;
  height: number | null;
  format: string;
  gps: { latitude: number; longitude: number } | null;
  sizeBytes: number;
}

interface GroundTruthItem {
  hasDamage: string;
  damageTypes: string;
  notes: string;
}

function loadManifest(): ManifestItem[] {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`ERROR: Manifest not found at ${MANIFEST_PATH}. Populate ./my-photos/ first.`);
    process.exit(1);
  }
  const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error(`ERROR: Manifest at ${MANIFEST_PATH} is empty.`);
    process.exit(1);
  }
  return parsed;
}

function loadGroundTruth(): Map<string, GroundTruthItem> {
  const map = new Map<string, GroundTruthItem>();
  if (fs.existsSync(GROUND_TRUTH_PATH)) {
    const lines = fs.readFileSync(GROUND_TRUTH_PATH, "utf-8").split("\n").filter(Boolean);
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts[0]) {
        map.set(parts[0], {
          hasDamage: parts[1] || "unknown",
          damageTypes: parts[2] ? parts[2].replace(/^"|"$/g, "") : "",
          notes: parts.slice(3).join(",").replace(/^"|"$/g, "") || "",
        });
      }
    }
  }
  return map;
}

interface RawDiagnosis {
  concept: string;
  confidence: number;
  relativeAreaPercent: number;
  status: "KEPT" | "DROPPED_CONFIDENCE" | "DROPPED_AREA" | "DROPPED_NMS";
  reason: string;
}

export function diagnoseRawFindings(
  rawFindings: CandidateFinding[],
  minConfOverride?: (concept: string) => number,
  minAreaRatioOverride?: number
): RawDiagnosis[] {
  const minConfFn = minConfOverride || getMinConfidenceForConcept;
  const minAreaRatio = minAreaRatioOverride !== undefined ? minAreaRatioOverride : MIN_AREA_RATIO;
  const minAreaPercent = minAreaRatio * 100;

  const sorted = [...rawFindings].sort((a, b) => b.confidence - a.confidence);
  const diagnoses: RawDiagnosis[] = [];
  const keptForNMS: CandidateFinding[] = [];

  for (const f of sorted) {
    const minConf = minConfFn(f.concept);
    if (f.confidence < minConf) {
      diagnoses.push({
        concept: f.concept,
        confidence: f.confidence,
        relativeAreaPercent: f.relativeAreaPercent,
        status: "DROPPED_CONFIDENCE",
        reason: `conf ${f.confidence.toFixed(2)} < ${minConf.toFixed(2)}`,
      });
      continue;
    }

    if (f.relativeAreaPercent < minAreaPercent - 1e-9) {
      diagnoses.push({
        concept: f.concept,
        confidence: f.confidence,
        relativeAreaPercent: f.relativeAreaPercent,
        status: "DROPPED_AREA",
        reason: `area ${f.relativeAreaPercent.toFixed(2)}% < ${minAreaPercent.toFixed(2)}%`,
      });
      continue;
    }

    // Check NMS against kept
    let suppressed = false;
    for (const kept of keptForNMS) {
      const boxIoU = computeBoxIoU(f.boundingBox, kept.boundingBox);
      if (boxIoU > 0.5) {
        suppressed = true;
        diagnoses.push({
          concept: f.concept,
          confidence: f.confidence,
          relativeAreaPercent: f.relativeAreaPercent,
          status: "DROPPED_NMS",
          reason: `IoU ${boxIoU.toFixed(2)} > 0.5 with higher-conf #${kept.concept} (${kept.confidence.toFixed(2)})`,
        });
        break;
      }
    }

    if (!suppressed) {
      keptForNMS.push(f);
      diagnoses.push({
        concept: f.concept,
        confidence: f.confidence,
        relativeAreaPercent: f.relativeAreaPercent,
        status: "KEPT",
        reason: "passed all filters",
      });
    }
  }

  return diagnoses;
}

async function runEval() {
  const isDebugRaw = process.env.DEBUG_RAW === "true" || process.argv.includes("--debug");
  const singleImage = process.argv.find((a) => !a.startsWith("-") && a.endsWith(".jpg"));

  const manifest = loadManifest();
  const groundTruth = loadGroundTruth();

  const targetList = singleImage
    ? manifest.filter((m) => m.filename === path.basename(singleImage))
    : manifest;

  if (targetList.length === 0) {
    console.error(`ERROR: No matching photos found for target: ${singleImage}`);
    process.exit(1);
  }

  console.log(`\n========================================================================`);
  console.log(`       VIAGUARD REAL PHOTO EVALUATION & DIAGNOSIS HARNESS`);
  console.log(`========================================================================`);
  console.log(`Photos to evaluate: ${targetList.length}`);
  console.log(`Live Meta API: ${Boolean(process.env.MODEL_API_KEY)}`);
  console.log(`Debug Raw Mode: ${isDebugRaw}`);
  console.log(`Evaluation Cache Dir: ${CACHE_DIR}\n`);

  let liveApiCallsCount = 0;
  const MAX_ALLOWED_API_CALLS = 60; // Cap to prevent accidental infinite loops

  const results: any[] = [];
  const rawDiagnosesAll: { filename: string; diagnoses: RawDiagnosis[] }[] = [];

  for (const item of targetList) {
    const photoPath = path.join(MY_PHOTOS_DIR, item.filename);
    if (!fs.existsSync(photoPath)) {
      console.warn(`File missing on disk: ${photoPath}`);
      continue;
    }

    console.log(`\n>>> Processing: ${item.filename} (${item.hash.slice(0, 10)}...)`);

    // Read and preprocess to max 1600px long edge
    const origBuffer = fs.readFileSync(photoPath);
    const meta = await sharp(origBuffer).metadata();
    const origW = meta.width || 1600;
    const origH = meta.height || 1200;
    const maxEdge = Math.max(origW, origH);
    const scale = maxEdge > 1600 ? 1600 / maxEdge : 1.0;
    const targetW = Math.round(origW * scale);
    const targetH = Math.round(origH * scale);

    const resizedBuffer = await sharp(origBuffer)
      .rotate()
      .resize(targetW, targetH, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const base64 = resizedBuffer.toString("base64");
    const mimeType = "image/jpeg";

    // 1. Scene understanding (cached or live)
    const sceneCacheFile = path.join(CACHE_DIR, `scene-${item.hash}.json`);
    let scene: any;
    if (fs.existsSync(sceneCacheFile)) {
      scene = JSON.parse(fs.readFileSync(sceneCacheFile, "utf-8"));
      console.log(`  [Scene] Cached Muse Spark response: "${scene.scene_type}", condition: "${scene.overall_condition}"`);
    } else {
      if (liveApiCallsCount >= MAX_ALLOWED_API_CALLS) {
        console.error(`API Call Cap reached (${MAX_ALLOWED_API_CALLS}). Aborting.`);
        process.exit(1);
      }
      liveApiCallsCount++;
      console.log(`  [Scene] Calling Muse Spark live...`);
      const res = await understandSceneWithMuseSpark({
        imageBase64: base64,
        imageHash: item.hash,
        moduleType: "road",
        mimeType,
        useCache: false,
      });
      scene = res.scene;
      fs.writeFileSync(sceneCacheFile, JSON.stringify(scene, null, 2), "utf-8");
    }

    const conceptsToSegment = sanitizeConcepts(scene.visible_damage_types, "road", 4);
    console.log(`  [Concepts] Sanitized query concepts: ${JSON.stringify(conceptsToSegment)}`);

    // 2. SAM 3.1 segmentation for each concept
    const rawFindings: CandidateFinding[] = [];
    for (const concept of conceptsToSegment) {
      const samCacheFile = path.join(CACHE_DIR, `sam-${item.hash}-${concept}.json`);
      let findingsForConcept: CandidateFinding[];
      if (fs.existsSync(samCacheFile)) {
        findingsForConcept = JSON.parse(fs.readFileSync(samCacheFile, "utf-8"));
        console.log(`  [SAM Cached] Concept "${concept}": ${findingsForConcept.length} raw instance(s)`);
      } else {
        if (liveApiCallsCount >= MAX_ALLOWED_API_CALLS) {
          console.error(`API Call Cap reached (${MAX_ALLOWED_API_CALLS}). Aborting.`);
          process.exit(1);
        }
        liveApiCallsCount++;
        console.log(`  [SAM Live] Querying "${concept}" with SAM 3.1...`);
        const samRes = await segmentConceptWithSAM({
          concept,
          imageBase64: base64,
          imageHash: item.hash,
          imageWidth: targetW,
          imageHeight: targetH,
          mimeType,
          useCache: false,
        });
        findingsForConcept = samRes.findings;
        fs.writeFileSync(samCacheFile, JSON.stringify(findingsForConcept, null, 2), "utf-8");
        console.log(`  [SAM Live] Concept "${concept}": returned ${findingsForConcept.length} raw instance(s)`);
      }
      rawFindings.push(...findingsForConcept);
    }

    // 3. Raw Diagnoses
    const diagnoses = diagnoseRawFindings(rawFindings);
    rawDiagnosesAll.push({ filename: item.filename, diagnoses });

    if (isDebugRaw || diagnoses.length > 0) {
      console.log(`  --- Raw SAM Instances Diagnoses (${rawFindings.length} total) ---`);
      if (rawFindings.length === 0) {
        console.log(`    (SAM returned 0 instances across all concepts)`);
      }
      diagnoses.forEach((d, idx) => {
        const mark = d.status === "KEPT" ? "[KEPT]" : `[${d.status}]`;
        console.log(`    #${idx + 1} "${d.concept}" | conf: ${d.confidence.toFixed(2)} | area: ${d.relativeAreaPercent.toFixed(2)}% -> ${mark} ${d.reason}`);
      });
    }

    // 4. Current filtering & severity
    const filteredFindings: DamageFinding[] = postProcessFindings(rawFindings);
    const severity = calculateSeverity(filteredFindings);
    const gt = groundTruth.get(item.filename);

    results.push({
      filename: item.filename,
      rawCount: rawFindings.length,
      detectionsKept: filteredFindings.length,
      severityScore: severity.score,
      severityLevel: severity.level,
      visualCondition: scene.overall_condition,
      sceneType: scene.scene_type,
      groundTruth: gt?.hasDamage || "unknown",
      gtDamageTypes: gt?.damageTypes || "",
      notes: gt?.notes || scene.notes || "",
    });
  }

  console.log(`\n========================================================================`);
  console.log(`                    BASELINE EVALUATION RESULTS (BEFORE)`);
  console.log(`========================================================================\n`);

  console.log(`| Filename | Raw SAM | Detections Kept | Severity Score & Level | Visual Condition (Muse Spark) | Ground Truth | Notes |`);
  console.log(`|---|---|---|---|---|---|---|`);
  for (const r of results) {
    console.log(
      `| \`${r.filename}\` | ${r.rawCount} | ${r.detectionsKept} | ${r.severityScore}/100 (${r.severityLevel}) | ${r.visualCondition.toUpperCase()} | ${r.groundTruth} | ${r.notes.replace(/\|/g, "/")} |`
    );
  }

  // Summary counts
  const totalPhotos = results.length;
  const zeroDetections = results.filter((r) => r.detectionsKept === 0).length;
  const poorVisual = results.filter((r) => r.visualCondition.toLowerCase() === "poor").length;
  const poorWithZeroDetections = results.filter(
    (r) => r.visualCondition.toLowerCase() === "poor" && r.detectionsKept === 0
  ).length;

  console.log(`\nSummary:`);
  console.log(`- Total Photos: ${totalPhotos}`);
  console.log(`- Photos with 0 Kept Detections: ${zeroDetections}/${totalPhotos}`);
  console.log(`- Photos rated POOR by Muse Spark: ${poorVisual}/${totalPhotos}`);
  console.log(`- Photos rated POOR with 0 SAM Detections (Recall Misses): ${poorWithZeroDetections}`);
  console.log(`- Total live API calls made this run: ${liveApiCallsCount}`);

  // Save results json
  const outPath = path.join(CACHE_DIR, "eval-results-baseline.json");
  fs.writeFileSync(outPath, JSON.stringify({ results, rawDiagnosesAll }, null, 2), "utf-8");
  console.log(`\nSaved baseline evaluation results to ${outPath}\n`);
}

runEval().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
