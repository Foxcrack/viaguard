import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import sharp from "sharp";
import exifr from "exifr";
import {
  InspectionReport,
  GeoLocation,
  DamageFinding,
  DEFAULT_CONSTRUCTION_CONCEPTS,
  calculateSeverity,
  compareConstructionSites,
} from "@viaguard/core";
import {
  understandSceneWithMuseSpark,
  segmentConceptWithSAM,
  writeReportWithMuseSpark,
  tokenTracker,
} from "./meta-client.js";
import { storage } from "./storage.js";
import { CACHE_DIR, UPLOAD_DIR } from "./paths.js";

function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export interface RecordedDemoBundle {
  recordedFromLiveApi: true;
  recordedAt: string;
  module: "road" | "construction";
  imageHash: string;
  sourceFiles: string[];
  report: InspectionReport;
}

function getDemoBundlePath(module: "road" | "construction", hashKey: string): string {
  return path.join(CACHE_DIR, `demo-${module}-${hashKey}.json`);
}

function loadVerifiedDemoBundle(
  module: "road" | "construction",
  hashKey: string
): RecordedDemoBundle | null {
  const filePath = getDemoBundlePath(module, hashKey);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<RecordedDemoBundle>;
    if (
      parsed &&
      parsed.recordedFromLiveApi === true &&
      parsed.module === module &&
      parsed.report
    ) {
      return parsed as RecordedDemoBundle;
    }
  } catch (err) {
    console.warn(`[Demo Cache Read Warning] Failed reading ${filePath}:`, err);
  }
  return null;
}

export function saveVerifiedDemoBundle(bundle: RecordedDemoBundle): string {
  ensureCacheDir();
  const filePath = getDemoBundlePath(bundle.module, bundle.imageHash);
  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf-8");
  return filePath;
}

export interface PreprocessedImage {
  buffer: Buffer;
  base64: string;
  hash: string;
  width: number;
  height: number;
  fileName: string;
  relativeUrl: string;
  exifGps?: { latitude: number; longitude: number };
}

/**
 * Applies Gaussian blur to sensitive regions (pedestrians, license plates)
 * for civic privacy-by-design compliance.
 */
export async function applyPrivacyBlur(
  imageBuffer: Buffer,
  privacyFindings: DamageFinding[]
): Promise<Buffer> {
  if (privacyFindings.length === 0) return imageBuffer;

  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width || 800;
  const height = meta.height || 600;

  const compositeOperations: sharp.OverlayOptions[] = [];

  for (const f of privacyFindings) {
    const left = Math.max(0, Math.floor(f.boundingBox.x1));
    const top = Math.max(0, Math.floor(f.boundingBox.y1));
    const w = Math.min(width - left, Math.ceil(f.boundingBox.width));
    const h = Math.min(height - top, Math.ceil(f.boundingBox.height));

    if (w > 5 && h > 5) {
      const blurredRegion = await sharp(imageBuffer)
        .extract({ left, top, width: w, height: h })
        .blur(25)
        .toBuffer();

      compositeOperations.push({
        input: blurredRegion,
        left,
        top,
      });
    }
  }

  if (compositeOperations.length > 0) {
    return await sharp(imageBuffer).composite(compositeOperations).toBuffer();
  }
  return imageBuffer;
}

/**
 * Step 1: Preprocesses image:
 * - Validates size & MIME type
 * - Extracts EXIF GPS prior to any modifications
 * - Resizes long edge to max 1600px
 * - Computes sha256 hash
 * - Saves file to disk
 */
export async function preprocessImage(
  buffer: Buffer,
  originalName?: string,
  providedMime?: string
): Promise<PreprocessedImage> {
  ensureUploadDir();

  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("File exceeds maximum allowed upload size (10 MB).");
  }

  let exifGps: { latitude: number; longitude: number } | undefined;
  try {
    const gpsData = await exifr.gps(buffer);
    if (gpsData?.latitude && gpsData?.longitude) {
      exifGps = {
        latitude: Number(gpsData.latitude.toFixed(6)),
        longitude: Number(gpsData.longitude.toFixed(6)),
      };
    }
  } catch (err) {
    console.warn("[EXIF Extraction] Non-fatal warning reading EXIF:", err);
  }

  const sharpImg = sharp(buffer);
  const meta = await sharpImg.metadata();
  if (!meta.format || !["jpeg", "jpg", "png", "webp"].includes(meta.format)) {
    throw new Error(
      `Unsupported image format: "${meta.format || providedMime}". Please upload JPEG, PNG, or WebP.`
    );
  }

  const originalWidth = meta.width || 800;
  const originalHeight = meta.height || 600;
  const maxDimension = 1600;

  let processedBuffer = buffer;
  let finalWidth = originalWidth;
  let finalHeight = originalHeight;

  if (originalWidth > maxDimension || originalHeight > maxDimension) {
    processedBuffer = await sharp(buffer)
      .resize({
        width: originalWidth >= originalHeight ? maxDimension : undefined,
        height: originalHeight > originalWidth ? maxDimension : undefined,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const resizedMeta = await sharp(processedBuffer).metadata();
    finalWidth = resizedMeta.width || finalWidth;
    finalHeight = resizedMeta.height || finalHeight;
  }

  const hash = crypto.createHash("sha256").update(processedBuffer).digest("hex");
  const ext = meta.format === "png" ? "png" : meta.format === "webp" ? "webp" : "jpg";
  const fileName = `${Date.now()}-${hash.slice(0, 12)}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  fs.writeFileSync(filePath, processedBuffer);

  return {
    buffer: processedBuffer,
    base64: processedBuffer.toString("base64"),
    hash,
    width: finalWidth,
    height: finalHeight,
    fileName,
    relativeUrl: `/uploads/${fileName}`,
    exifGps,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx]);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export type ProgressCallback = (step: string, percent: number) => void;

/**
 * Executes the complete 6-step Road Damage Inspection Pipeline.
 *
 * Honesty Rules:
 * - Default mode is strictly LIVE (demoMode = false).
 * - Demo mode NEVER activates silently when MODEL_API_KEY is missing or an API call fails.
 * - Demo mode only runs when explicitly requested (options.demoMode === true or DEMO_MODE=true)
 *   and ONLY replays real API responses recorded via `pnpm record:demo`.
 */
export async function runRoadPipeline(options: {
  imageBuffer: Buffer;
  originalName?: string;
  clientLocation?: { latitude: number; longitude: number; source: "browser" | "manual" };
  demoMode?: boolean;
  recordDemo?: boolean;
  onProgress?: ProgressCallback;
}): Promise<InspectionReport> {
  const notify = options.onProgress || (() => {});

  // Step 1: Preprocess
  notify("Validating and optimizing image...", 15);
  const preprocessed = await preprocessImage(options.imageBuffer, options.originalName);

  // Resolve location: EXIF first, then client, else undefined
  let resolvedLocation: GeoLocation | undefined;
  if (preprocessed.exifGps) {
    resolvedLocation = {
      latitude: preprocessed.exifGps.latitude,
      longitude: preprocessed.exifGps.longitude,
      source: "exif",
    };
  } else if (options.clientLocation) {
    resolvedLocation = {
      latitude: options.clientLocation.latitude,
      longitude: options.clientLocation.longitude,
      source: options.clientLocation.source,
    };
  }

  const explicitDemoMode =
    !options.recordDemo &&
    (options.demoMode === true || process.env.DEMO_MODE === "true");

  if (explicitDemoMode) {
    const bundle = loadVerifiedDemoBundle("road", preprocessed.hash);
    if (bundle) {
      notify("Replaying cached real responses...", 85);
      const replayedReport: InspectionReport = {
        ...bundle.report,
        id: `rep-road-replay-${Date.now()}-${preprocessed.hash.slice(0, 6)}`,
        createdAt: new Date().toISOString(),
        imageUrl: preprocessed.relativeUrl,
        location: resolvedLocation ?? bundle.report.location,
        isCached: true,
      };
      await storage.save(replayedReport);
      notify("Replaying cached real responses complete.", 100);
      return replayedReport;
    }

    // Attempt step-level verified cache replay if recorded via step cache; throws if absent
    notify("Replaying cached real responses...", 35);
    const { scene } = await understandSceneWithMuseSpark({
      imageBase64: preprocessed.base64,
      imageHash: preprocessed.hash,
      moduleType: "road",
      useCache: true,
    });
    const conceptsToSegment = Array.from(
      new Set([...scene.visible_damage_types.slice(0, 3), "pothole", "crack"])
    ).slice(0, 4);
    notify("Replaying cached SAM 3.1 segmentations...", 60);
    const findingsNested = await runWithConcurrency(conceptsToSegment, 2, async (concept) => {
      const { findings } = await segmentConceptWithSAM({
        concept,
        imageBase64: preprocessed.base64,
        imageHash: preprocessed.hash,
        imageWidth: preprocessed.width,
        imageHeight: preprocessed.height,
        useCache: true,
      });
      return findings;
    });
    const allFindings = findingsNested.flat();
    const severity = calculateSeverity(allFindings);
    notify("Replaying cached Muse Spark engineering report...", 90);
    const { report: structuredReport } = await writeReportWithMuseSpark({
      module: "road",
      scene,
      findings: allFindings,
      severityScore: severity.score,
      severityLevel: severity.level,
      imageHash: preprocessed.hash,
      useCache: true,
    });
    const reportId = `rep-road-replay-${Date.now()}-${preprocessed.hash.slice(0, 8)}`;
    const replayed: InspectionReport = {
      id: reportId,
      module: "road",
      createdAt: new Date().toISOString(),
      imageUrl: preprocessed.relativeUrl,
      imageWidth: preprocessed.width,
      imageHeight: preprocessed.height,
      location: resolvedLocation,
      sceneType: scene.scene_type,
      overallCondition: scene.overall_condition,
      severityScore: severity.score,
      severityLevel: severity.level,
      findings: allFindings,
      title: structuredReport.title,
      summary: structuredReport.summary,
      recommendedAction: structuredReport.recommendedAction,
      estimatedUrgency: structuredReport.estimatedUrgency,
      isCached: true,
      modelsUsed: {
        vision: "muse-spark-1.3",
        segmentation: "sam-3.1",
      },
    };
    await storage.save(replayed);
    notify("Replaying cached real responses complete.", 100);
    return replayed;
  }

  // LIVE MODE: Never silently switch to demo mode when key is missing or API fails
  if (!process.env.MODEL_API_KEY || process.env.MODEL_API_KEY.trim() === "") {
    throw new Error(
      "Live Mode Error: MODEL_API_KEY is not set in .env. Configure MODEL_API_KEY at the project root to call Meta Muse Spark and SAM 3.1 live (demo mode never activates automatically)."
    );
  }

  const recordToCache = Boolean(options.recordDemo);

  // Step 2: Scene Understanding (Muse Spark)
  notify("Understanding scene structure with Muse Spark...", 35);
  const { scene } = await understandSceneWithMuseSpark({
    imageBase64: preprocessed.base64,
    imageHash: preprocessed.hash,
    moduleType: "road",
    useCache: false,
    recordToCache,
  });

  // Select up to 4 concepts for SAM segmentation
  const conceptsToSegment = Array.from(
    new Set([
      ...scene.visible_damage_types.slice(0, 3),
      "pothole",
      "crack",
    ])
  ).slice(0, 4);

  // Step 3: SAM 3.1 Segmentation (concurrency limit = 2)
  notify(`Segmenting road damage concepts (${conceptsToSegment.join(", ")})...`, 60);
  const findingsNested = await runWithConcurrency(
    conceptsToSegment,
    2,
    async (concept) => {
      const { findings } = await segmentConceptWithSAM({
        concept,
        imageBase64: preprocessed.base64,
        imageHash: preprocessed.hash,
        imageWidth: preprocessed.width,
        imageHeight: preprocessed.height,
        useCache: false,
        recordToCache,
      });
      return findings;
    }
  );
  const allFindings: DamageFinding[] = findingsNested.flat();

  // Step 4: Deterministic Scoring
  notify("Computing objective severity index and relative areas...", 75);
  const severity = calculateSeverity(allFindings);

  // Step 5: Muse Spark Report Generation
  notify("Authoring municipal engineering report...", 90);
  const { report: structuredReport } = await writeReportWithMuseSpark({
    module: "road",
    scene,
    findings: allFindings,
    severityScore: severity.score,
    severityLevel: severity.level,
    imageHash: preprocessed.hash,
    useCache: false,
    recordToCache,
  });

  // Step 6: Persist Report
  notify("Finalizing and persisting inspection report...", 98);
  const reportId = `rep-road-${Date.now()}-${preprocessed.hash.slice(0, 8)}`;
  const inspectionReport: InspectionReport = {
    id: reportId,
    module: "road",
    createdAt: new Date().toISOString(),
    imageUrl: preprocessed.relativeUrl,
    imageWidth: preprocessed.width,
    imageHeight: preprocessed.height,
    location: resolvedLocation,
    sceneType: scene.scene_type,
    overallCondition: scene.overall_condition,
    severityScore: severity.score,
    severityLevel: severity.level,
    findings: allFindings,
    title: structuredReport.title,
    summary: structuredReport.summary,
    recommendedAction: structuredReport.recommendedAction,
    estimatedUrgency: structuredReport.estimatedUrgency,
    isCached: false,
    tokenUsage: {
      promptTokens: tokenTracker.totalPromptTokens,
      completionTokens: tokenTracker.totalCompletionTokens,
      totalTokens: tokenTracker.totalTokens,
    },
    modelsUsed: {
      vision: "muse-spark-1.3",
      segmentation: "sam-3.1",
    },
  };

  if (recordToCache) {
    saveVerifiedDemoBundle({
      recordedFromLiveApi: true,
      recordedAt: new Date().toISOString(),
      module: "road",
      imageHash: preprocessed.hash,
      sourceFiles: [options.originalName || preprocessed.fileName],
      report: inspectionReport,
    });
  }

  await storage.save(inspectionReport);
  notify("Inspection complete.", 100);

  return inspectionReport;
}

/**
 * Executes the complete Construction Progress Pipeline (Before & After comparison)
 */
export async function runConstructionPipeline(options: {
  beforeBuffer: Buffer;
  afterBuffer: Buffer;
  beforeName?: string;
  afterName?: string;
  demoMode?: boolean;
  recordDemo?: boolean;
  onProgress?: ProgressCallback;
}): Promise<InspectionReport> {
  const notify = options.onProgress || (() => {});

  notify("Pre-processing BEFORE and AFTER inspection images...", 15);
  const beforePrep = await preprocessImage(options.beforeBuffer, options.beforeName || "before.jpg");
  const afterPrep = await preprocessImage(options.afterBuffer, options.afterName || "after.jpg");
  const pairHash = `${beforePrep.hash}-${afterPrep.hash}`;

  const explicitDemoMode =
    !options.recordDemo &&
    (options.demoMode === true || process.env.DEMO_MODE === "true");

  if (explicitDemoMode) {
    const bundle = loadVerifiedDemoBundle("construction", pairHash);
    if (!bundle) {
      throw new Error(
        "No cached real API response found in data/cache/ for this construction image pair. Set MODEL_API_KEY in .env and run 'pnpm record:demo <before-image> <after-image>' first, or turn off Demo Mode."
      );
    }
    notify("Replaying cached real responses...", 85);
    const replayedReport: InspectionReport = {
      ...bundle.report,
      id: `rep-const-replay-${Date.now()}-${afterPrep.hash.slice(0, 6)}`,
      createdAt: new Date().toISOString(),
      imageUrl: beforePrep.relativeUrl,
      afterImageUrl: afterPrep.relativeUrl,
      isCached: true,
    };
    await storage.save(replayedReport);
    notify("Replaying cached real responses complete.", 100);
    return replayedReport;
  }

  if (!process.env.MODEL_API_KEY || process.env.MODEL_API_KEY.trim() === "") {
    throw new Error(
      "Live Mode Error: MODEL_API_KEY is not set in .env. Configure MODEL_API_KEY at the project root to call Meta Muse Spark and SAM 3.1 live (demo mode never activates automatically)."
    );
  }

  const recordToCache = Boolean(options.recordDemo);

  notify("Analyzing site baseline and evolution with Muse Spark...", 35);
  const { scene: beforeScene } = await understandSceneWithMuseSpark({
    imageBase64: beforePrep.base64,
    imageHash: beforePrep.hash,
    moduleType: "construction",
    useCache: false,
    recordToCache,
  });

  const { scene: afterScene } = await understandSceneWithMuseSpark({
    imageBase64: afterPrep.base64,
    imageHash: afterPrep.hash,
    moduleType: "construction",
    useCache: false,
    recordToCache,
  });

  const comparativeConcepts = Array.from(
    new Set([
      ...beforeScene.visible_damage_types,
      ...afterScene.visible_damage_types,
      ...DEFAULT_CONSTRUCTION_CONCEPTS,
    ])
  ).slice(0, 5);

  notify(`Running comparative SAM segmentation (${comparativeConcepts.join(", ")})...`, 60);

  const beforeFindingsNested = await runWithConcurrency(
    comparativeConcepts,
    2,
    async (concept) => {
      const { findings } = await segmentConceptWithSAM({
        concept,
        imageBase64: beforePrep.base64,
        imageHash: beforePrep.hash,
        imageWidth: beforePrep.width,
        imageHeight: beforePrep.height,
        useCache: false,
        recordToCache,
      });
      return findings;
    }
  );
  const beforeFindings = beforeFindingsNested.flat();

  const afterFindingsNested = await runWithConcurrency(
    comparativeConcepts,
    2,
    async (concept) => {
      const { findings } = await segmentConceptWithSAM({
        concept,
        imageBase64: afterPrep.base64,
        imageHash: afterPrep.hash,
        imageWidth: afterPrep.width,
        imageHeight: afterPrep.height,
        useCache: false,
        recordToCache,
      });
      return findings;
    }
  );
  const afterFindings = afterFindingsNested.flat();

  notify("Computing quantitative diff and volumetric progress index...", 80);
  const diffResult = compareConstructionSites(
    beforeFindings,
    afterFindings,
    comparativeConcepts
  );

  const diffSummary = diffResult.conceptChanges
    .map(
      (c) =>
        `- ${c.concept}: Delta Count = ${c.deltaCount >= 0 ? "+" : ""}${c.deltaCount}, Delta Area = ${
          c.deltaAreaPercent >= 0 ? "+" : ""
        }${c.deltaAreaPercent}% (${c.status.toUpperCase()})`
    )
    .join("\n");

  notify("Authoring comparative progression report with Muse Spark...", 92);
  const severity = calculateSeverity(afterFindings);

  const { report: structuredReport } = await writeReportWithMuseSpark({
    module: "construction",
    scene: afterScene,
    findings: afterFindings,
    severityScore: severity.score,
    severityLevel: severity.level,
    imageHash: pairHash,
    constructionDiffSummary: `${diffResult.overallAssessment}\n${diffSummary}`,
    useCache: false,
    recordToCache,
  });

  const reportId = `rep-const-${Date.now()}-${afterPrep.hash.slice(0, 8)}`;
  const inspectionReport: InspectionReport = {
    id: reportId,
    module: "construction",
    createdAt: new Date().toISOString(),
    imageUrl: beforePrep.relativeUrl,
    afterImageUrl: afterPrep.relativeUrl,
    imageWidth: beforePrep.width,
    imageHeight: beforePrep.height,
    afterImageWidth: afterPrep.width,
    afterImageHeight: afterPrep.height,
    sceneType: afterScene.scene_type,
    overallCondition: afterScene.overall_condition,
    severityScore: severity.score,
    severityLevel: severity.level,
    findings: beforeFindings,
    afterFindings: afterFindings,
    constructionDiff: diffResult,
    title: structuredReport.title,
    summary: structuredReport.summary,
    recommendedAction: structuredReport.recommendedAction,
    estimatedUrgency: structuredReport.estimatedUrgency,
    isCached: false,
    tokenUsage: {
      promptTokens: tokenTracker.totalPromptTokens,
      completionTokens: tokenTracker.totalCompletionTokens,
      totalTokens: tokenTracker.totalTokens,
    },
    modelsUsed: {
      vision: "muse-spark-1.3",
      segmentation: "sam-3.1",
    },
  };

  if (recordToCache) {
    saveVerifiedDemoBundle({
      recordedFromLiveApi: true,
      recordedAt: new Date().toISOString(),
      module: "construction",
      imageHash: pairHash,
      sourceFiles: [
        options.beforeName || beforePrep.fileName,
        options.afterName || afterPrep.fileName,
      ],
      report: inspectionReport,
    });
  }

  await storage.save(inspectionReport);
  notify("Construction progression analysis complete.", 100);

  return inspectionReport;
}
