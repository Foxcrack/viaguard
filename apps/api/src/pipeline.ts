import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import sharp from "sharp";
import exifr from "exifr";
import {
  InspectionReport,
  GeoLocation,
  DamageFinding,
  CandidateFinding,
  PRIVACY_CONCEPTS,
  PRIVACY_MIN_CONFIDENCE,
  calculateSeverity,
  compareConstructionSites,
  sanitizeConcepts,
  postProcessFindings,
  deduplicateFindingsNMS,
  getUrgencyForSeverity,
  buildNeutralReportTitle,
  normalizeVisualConditionLevel,
  toSingleSentenceExplanation,
  getSignalDiscrepancyNote,
  REPORT_LIMITATIONS_TEXT,
  normalizeInspectionReport,
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
  filePath: string;
  mimeType: string;
  relativeUrl: string;
  exifGps?: { latitude: number; longitude: number };
}

/**
 * Applies mosaic + Gaussian blur to sensitive regions ("person", "license plate")
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
    const rawLeft = Math.floor(f.boundingBox.x1);
    const rawTop = Math.floor(f.boundingBox.y1);
    const rawRight = Math.ceil(f.boundingBox.x2);
    const rawBottom = Math.ceil(f.boundingBox.y2);
    const rawW = rawRight - rawLeft;
    const rawH = rawBottom - rawTop;

    if (rawW < 2 || rawH < 2) continue;

    // Expand bounding box slightly so plate borders and facial edges are fully anonymized
    const pad = Math.max(6, Math.round(Math.max(rawW, rawH) * 0.08));
    const left = Math.max(0, rawLeft - pad);
    const top = Math.max(0, rawTop - pad);
    const right = Math.min(width, rawRight + pad);
    const bottom = Math.min(height, rawBottom + pad);
    const w = right - left;
    const h = bottom - top;

    if (w >= 2 && h >= 2) {
      const mosaicW = Math.max(2, Math.min(w, Math.round(w / 10)));
      const mosaicH = Math.max(2, Math.min(h, Math.round(h / 10)));
      const downscaled = await sharp(imageBuffer)
        .extract({ left, top, width: w, height: h })
        .resize(mosaicW, mosaicH, { fit: "fill", kernel: "lanczos3" })
        .toBuffer();

      const blurredRegion = await sharp(downscaled)
        .resize(w, h, { fit: "fill", kernel: "nearest" })
        .blur(10)
        .toBuffer();

      compositeOperations.push({
        input: blurredRegion,
        left,
        top,
      });
    }
  }

  if (compositeOperations.length > 0) {
    let pipeline = sharp(imageBuffer).composite(compositeOperations);
    if (meta.format === "png") {
      pipeline = pipeline.png();
    } else if (meta.format === "webp") {
      pipeline = pipeline.webp({ quality: 88 });
    } else {
      pipeline = pipeline.jpeg({ quality: 88 });
    }
    return await pipeline.toBuffer();
  }
  return imageBuffer;
}

/**
 * Step 1: Preprocesses image:
 * - Validates size & MIME type
 * - Extracts EXIF GPS prior to any modifications
 * - Normalizes EXIF orientation and resizes long edge to max 1600px
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
  const needsOrientationFix = Boolean(meta.orientation && meta.orientation !== 1);
  const needsResize = originalWidth > maxDimension || originalHeight > maxDimension;

  let processedBuffer = buffer;
  let finalWidth = originalWidth;
  let finalHeight = originalHeight;

  if (needsOrientationFix || needsResize) {
    let transform = sharp(buffer).rotate();
    if (needsResize) {
      transform = transform.resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    if (meta.format === "png") {
      transform = transform.png();
    } else if (meta.format === "webp") {
      transform = transform.webp({ quality: 85 });
    } else {
      transform = transform.jpeg({ quality: 85 });
    }
    processedBuffer = await transform.toBuffer();

    const resizedMeta = await sharp(processedBuffer).metadata();
    finalWidth = resizedMeta.width || finalWidth;
    finalHeight = resizedMeta.height || finalHeight;
  }

  const hash = crypto.createHash("sha256").update(processedBuffer).digest("hex");
  const ext = meta.format === "png" ? "png" : meta.format === "webp" ? "webp" : "jpg";
  const mimeType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
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
    filePath,
    mimeType,
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
 * Segments privacy-sensitive concepts ("person", "license plate") with SAM 3.1
 * and blurs those regions directly in the stored upload image on disk.
 */
async function segmentAndApplyPrivacyBlur(options: {
  preprocessed: PreprocessedImage;
  useCache: boolean;
  recordToCache: boolean;
}): Promise<{ regionsBlurred: number }> {
  const privacyNested = await runWithConcurrency(
    [...PRIVACY_CONCEPTS],
    2,
    async (concept) => {
      try {
        const { findings } = await segmentConceptWithSAM({
          concept,
          imageBase64: options.preprocessed.base64,
          imageHash: options.preprocessed.hash,
          imageWidth: options.preprocessed.width,
          imageHeight: options.preprocessed.height,
          mimeType: options.preprocessed.mimeType,
          useCache: options.useCache,
          recordToCache: options.recordToCache,
        });
        return findings;
      } catch (err) {
        if (options.useCache) {
          return [];
        }
        throw err;
      }
    }
  );

  const rawPrivacy = privacyNested
    .flat()
    .filter((f) => f.confidence >= PRIVACY_MIN_CONFIDENCE);
  const dedupedPrivacy = deduplicateFindingsNMS(rawPrivacy, 0.5);

  if (dedupedPrivacy.length > 0) {
    const blurredBuffer = await applyPrivacyBlur(
      options.preprocessed.buffer,
      dedupedPrivacy
    );
    fs.writeFileSync(options.preprocessed.filePath, blurredBuffer);
    options.preprocessed.buffer = blurredBuffer;
  }

  return { regionsBlurred: dedupedPrivacy.length };
}

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
  privacyBlur?: boolean;
  demoMode?: boolean;
  recordDemo?: boolean;
  onProgress?: ProgressCallback;
}): Promise<InspectionReport> {
  const notify = options.onProgress || (() => {});
  const privacyBlur = options.privacyBlur ?? true;

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
      let regionsBlurred = bundle.report.privacyRegionsBlurred ?? 0;
      if (privacyBlur) {
        const blurRes = await segmentAndApplyPrivacyBlur({
          preprocessed,
          useCache: true,
          recordToCache: false,
        });
        regionsBlurred = blurRes.regionsBlurred;
      }
      const filteredBundleFindings = postProcessFindings(bundle.report.findings);
      const recomputedSeverity = calculateSeverity(filteredBundleFindings);
      const createdAt = new Date().toISOString();
      const loc = resolvedLocation ?? bundle.report.location;
      const replayedReport: InspectionReport = normalizeInspectionReport({
        ...bundle.report,
        id: `rep-road-replay-${Date.now()}-${preprocessed.hash.slice(0, 6)}`,
        createdAt,
        title: buildNeutralReportTitle({ module: "road", location: loc, createdAt }),
        imageUrl: preprocessed.relativeUrl,
        location: loc,
        findings: filteredBundleFindings,
        severityScore: recomputedSeverity.score,
        severityLevel: recomputedSeverity.level,
        severityBreakdown: recomputedSeverity.breakdown,
        estimatedUrgency: getUrgencyForSeverity(recomputedSeverity.level),
        privacyBlurApplied: privacyBlur,
        privacyRegionsBlurred: privacyBlur ? regionsBlurred : 0,
        isCached: true,
      });
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
      mimeType: preprocessed.mimeType,
      useCache: true,
    });
    const conceptsToSegment = sanitizeConcepts(scene.visible_damage_types, "road", 4);
    notify("Replaying cached SAM 3.1 segmentations...", 60);
    const findingsNested = await runWithConcurrency(conceptsToSegment, 2, async (concept) => {
      const { findings } = await segmentConceptWithSAM({
        concept,
        imageBase64: preprocessed.base64,
        imageHash: preprocessed.hash,
        imageWidth: preprocessed.width,
        imageHeight: preprocessed.height,
        mimeType: preprocessed.mimeType,
        useCache: true,
      });
      return findings;
    });
    const filteredFindings = postProcessFindings(findingsNested.flat());
    let regionsBlurred = 0;
    if (privacyBlur) {
      const blurRes = await segmentAndApplyPrivacyBlur({
        preprocessed,
        useCache: true,
        recordToCache: false,
      });
      regionsBlurred = blurRes.regionsBlurred;
    }
    const severity = calculateSeverity(filteredFindings);
    const urgency = getUrgencyForSeverity(severity.level);
    const visualLevel = normalizeVisualConditionLevel(scene.overall_condition);
    notify("Replaying cached Muse Spark engineering report...", 90);
    const { report: structuredReport } = await writeReportWithMuseSpark({
      module: "road",
      scene,
      findings: filteredFindings,
      severityScore: severity.score,
      severityLevel: severity.level,
      urgency,
      imageHash: preprocessed.hash,
      useCache: true,
    });
    const createdAt = new Date().toISOString();
    const reportId = `rep-road-replay-${Date.now()}-${preprocessed.hash.slice(0, 8)}`;
    const replayed: InspectionReport = normalizeInspectionReport({
      id: reportId,
      module: "road",
      createdAt,
      imageUrl: preprocessed.relativeUrl,
      imageWidth: preprocessed.width,
      imageHeight: preprocessed.height,
      location: resolvedLocation,
      sceneType: scene.scene_type,
      overallCondition: visualLevel,
      severityScore: severity.score,
      severityLevel: severity.level,
      severityBreakdown: severity.breakdown,
      measuredSeverity: {
        score: severity.score,
        level: severity.level,
        breakdown: severity.breakdown,
      },
      visualCondition: {
        level: visualLevel,
        explanation: toSingleSentenceExplanation(
          structuredReport.visualConditionExplanation || scene.notes,
          visualLevel,
          scene.scene_type
        ),
      },
      signalDiscrepancyNote: getSignalDiscrepancyNote(severity.level, visualLevel),
      limitations: REPORT_LIMITATIONS_TEXT,
      findings: filteredFindings,
      title: buildNeutralReportTitle({ module: "road", location: resolvedLocation, createdAt }),
      summary: structuredReport.summary,
      recommendedAction: structuredReport.recommendedAction,
      estimatedUrgency: urgency,
      isCached: true,
      privacyBlurApplied: privacyBlur,
      privacyRegionsBlurred: regionsBlurred,
      modelsUsed: {
        vision: "muse-spark-1.3",
        segmentation: "sam-3.1",
      },
    });
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
  notify("Understanding scene structure with Muse Spark...", 30);
  const { scene } = await understandSceneWithMuseSpark({
    imageBase64: preprocessed.base64,
    imageHash: preprocessed.hash,
    moduleType: "road",
    mimeType: preprocessed.mimeType,
    useCache: false,
    recordToCache,
  });

  // Sanitize concepts: 1-2 word plain nouns only, ALWAYS including "pothole" and "crack"
  const conceptsToSegment = sanitizeConcepts(scene.visible_damage_types, "road", 4);

  // Step 3: SAM 3.1 Segmentation (concurrency limit = 2)
  notify(`Segmenting road damage concepts (${conceptsToSegment.join(", ")})...`, 55);
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
        mimeType: preprocessed.mimeType,
        useCache: false,
        recordToCache,
      });
      return findings;
    }
  );
  const rawFindings: CandidateFinding[] = findingsNested.flat();

  // Filter by per-concept confidence, minimum mask area (MIN_AREA_RATIO = 0.15%), and cross-concept NMS (IoU > 0.5)
  const filteredFindings: DamageFinding[] = postProcessFindings(rawFindings);

  // Privacy Protection (ON by default): segment "person" and "license plate" and blur stored image
  let privacyRegionsBlurred = 0;
  if (privacyBlur) {
    notify("Anonymizing pedestrians and license plates (privacy blur)...", 70);
    const blurRes = await segmentAndApplyPrivacyBlur({
      preprocessed,
      useCache: false,
      recordToCache,
    });
    privacyRegionsBlurred = blurRes.regionsBlurred;
  }

  // Step 4: Deterministic Scoring & Fixed Urgency Mapping
  notify("Computing objective severity index and relative areas...", 80);
  const severity = calculateSeverity(filteredFindings);
  const urgency = getUrgencyForSeverity(severity.level);
  const visualLevel = normalizeVisualConditionLevel(scene.overall_condition);

  // Step 5: Muse Spark Report Narrative (given fixed urgency; never invents title or urgency)
  notify("Authoring municipal engineering report...", 90);
  const { report: structuredReport } = await writeReportWithMuseSpark({
    module: "road",
    scene,
    findings: filteredFindings,
    severityScore: severity.score,
    severityLevel: severity.level,
    urgency,
    imageHash: preprocessed.hash,
    useCache: false,
    recordToCache,
  });

  // Step 6: Persist Report
  notify("Finalizing and persisting inspection report...", 98);
  const createdAt = new Date().toISOString();
  const reportId = `rep-road-${Date.now()}-${preprocessed.hash.slice(0, 8)}`;
  const inspectionReport: InspectionReport = normalizeInspectionReport({
    id: reportId,
    module: "road",
    createdAt,
    imageUrl: preprocessed.relativeUrl,
    imageWidth: preprocessed.width,
    imageHeight: preprocessed.height,
    location: resolvedLocation,
    sceneType: scene.scene_type,
    overallCondition: visualLevel,
    severityScore: severity.score,
    severityLevel: severity.level,
    severityBreakdown: severity.breakdown,
    measuredSeverity: {
      score: severity.score,
      level: severity.level,
      breakdown: severity.breakdown,
    },
    visualCondition: {
      level: visualLevel,
      explanation: toSingleSentenceExplanation(
        structuredReport.visualConditionExplanation || scene.notes,
        visualLevel,
        scene.scene_type
      ),
    },
    signalDiscrepancyNote: getSignalDiscrepancyNote(severity.level, visualLevel),
    limitations: REPORT_LIMITATIONS_TEXT,
    findings: filteredFindings,
    title: buildNeutralReportTitle({ module: "road", location: resolvedLocation, createdAt }),
    summary: structuredReport.summary,
    recommendedAction: structuredReport.recommendedAction,
    estimatedUrgency: urgency,
    isCached: false,
    privacyBlurApplied: privacyBlur,
    privacyRegionsBlurred,
    tokenUsage: {
      promptTokens: tokenTracker.totalPromptTokens,
      completionTokens: tokenTracker.totalCompletionTokens,
      totalTokens: tokenTracker.totalTokens,
    },
    modelsUsed: {
      vision: "muse-spark-1.3",
      segmentation: "sam-3.1",
    },
  });

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
  privacyBlur?: boolean;
  demoMode?: boolean;
  recordDemo?: boolean;
  onProgress?: ProgressCallback;
}): Promise<InspectionReport> {
  const notify = options.onProgress || (() => {});
  const privacyBlur = options.privacyBlur ?? true;

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
    let regionsBlurred = bundle.report.privacyRegionsBlurred ?? 0;
    if (privacyBlur) {
      const [bBlur, aBlur] = await Promise.all([
        segmentAndApplyPrivacyBlur({
          preprocessed: beforePrep,
          useCache: true,
          recordToCache: false,
        }),
        segmentAndApplyPrivacyBlur({
          preprocessed: afterPrep,
          useCache: true,
          recordToCache: false,
        }),
      ]);
      regionsBlurred = bBlur.regionsBlurred + aBlur.regionsBlurred;
    }
    const filteredBefore = postProcessFindings(bundle.report.findings);
    const filteredAfter = bundle.report.afterFindings
      ? postProcessFindings(bundle.report.afterFindings)
      : undefined;
    const recomputedSeverity = calculateSeverity(filteredAfter ?? filteredBefore);
    const createdAt = new Date().toISOString();
    const replayedReport: InspectionReport = normalizeInspectionReport({
      ...bundle.report,
      id: `rep-const-replay-${Date.now()}-${afterPrep.hash.slice(0, 6)}`,
      createdAt,
      title: buildNeutralReportTitle({
        module: "construction",
        location: bundle.report.location,
        createdAt,
      }),
      imageUrl: beforePrep.relativeUrl,
      afterImageUrl: afterPrep.relativeUrl,
      findings: filteredBefore,
      afterFindings: filteredAfter,
      severityScore: recomputedSeverity.score,
      severityLevel: recomputedSeverity.level,
      severityBreakdown: recomputedSeverity.breakdown,
      estimatedUrgency: getUrgencyForSeverity(recomputedSeverity.level),
      privacyBlurApplied: privacyBlur,
      privacyRegionsBlurred: privacyBlur ? regionsBlurred : 0,
      isCached: true,
    });
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
    mimeType: beforePrep.mimeType,
    useCache: false,
    recordToCache,
  });

  const { scene: afterScene } = await understandSceneWithMuseSpark({
    imageBase64: afterPrep.base64,
    imageHash: afterPrep.hash,
    moduleType: "construction",
    mimeType: afterPrep.mimeType,
    useCache: false,
    recordToCache,
  });

  const comparativeConcepts = sanitizeConcepts(
    [...beforeScene.visible_damage_types, ...afterScene.visible_damage_types],
    "construction",
    5
  );

  notify(`Running comparative SAM segmentation (${comparativeConcepts.join(", ")})...`, 55);

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
        mimeType: beforePrep.mimeType,
        useCache: false,
        recordToCache,
      });
      return findings;
    }
  );
  const beforeFindings = postProcessFindings(beforeFindingsNested.flat());

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
        mimeType: afterPrep.mimeType,
        useCache: false,
        recordToCache,
      });
      return findings;
    }
  );
  const afterFindings = postProcessFindings(afterFindingsNested.flat());

  let privacyRegionsBlurred = 0;
  if (privacyBlur) {
    notify("Anonymizing site personnel and license plates (privacy blur)...", 72);
    const [bBlur, aBlur] = await Promise.all([
      segmentAndApplyPrivacyBlur({
        preprocessed: beforePrep,
        useCache: false,
        recordToCache,
      }),
      segmentAndApplyPrivacyBlur({
        preprocessed: afterPrep,
        useCache: false,
        recordToCache,
      }),
    ]);
    privacyRegionsBlurred = bBlur.regionsBlurred + aBlur.regionsBlurred;
  }

  notify("Computing quantitative diff and volumetric progress index...", 82);
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
  const urgency = getUrgencyForSeverity(severity.level);
  const visualLevel = normalizeVisualConditionLevel(afterScene.overall_condition);

  const { report: structuredReport } = await writeReportWithMuseSpark({
    module: "construction",
    scene: afterScene,
    findings: afterFindings,
    severityScore: severity.score,
    severityLevel: severity.level,
    urgency,
    imageHash: pairHash,
    constructionDiffSummary: `${diffResult.overallAssessment}\n${diffSummary}`,
    useCache: false,
    recordToCache,
  });

  const createdAt = new Date().toISOString();
  const reportId = `rep-const-${Date.now()}-${afterPrep.hash.slice(0, 8)}`;
  const inspectionReport: InspectionReport = normalizeInspectionReport({
    id: reportId,
    module: "construction",
    createdAt,
    imageUrl: beforePrep.relativeUrl,
    afterImageUrl: afterPrep.relativeUrl,
    imageWidth: beforePrep.width,
    imageHeight: beforePrep.height,
    afterImageWidth: afterPrep.width,
    afterImageHeight: afterPrep.height,
    sceneType: afterScene.scene_type,
    overallCondition: visualLevel,
    severityScore: severity.score,
    severityLevel: severity.level,
    severityBreakdown: severity.breakdown,
    measuredSeverity: {
      score: severity.score,
      level: severity.level,
      breakdown: severity.breakdown,
    },
    visualCondition: {
      level: visualLevel,
      explanation: toSingleSentenceExplanation(
        structuredReport.visualConditionExplanation || afterScene.notes,
        visualLevel,
        afterScene.scene_type
      ),
    },
    signalDiscrepancyNote: getSignalDiscrepancyNote(severity.level, visualLevel),
    limitations: REPORT_LIMITATIONS_TEXT,
    findings: beforeFindings,
    afterFindings: afterFindings,
    constructionDiff: diffResult,
    title: buildNeutralReportTitle({ module: "construction", createdAt }),
    summary: structuredReport.summary,
    recommendedAction: structuredReport.recommendedAction,
    estimatedUrgency: urgency,
    isCached: false,
    privacyBlurApplied: privacyBlur,
    privacyRegionsBlurred,
    tokenUsage: {
      promptTokens: tokenTracker.totalPromptTokens,
      completionTokens: tokenTracker.totalCompletionTokens,
      totalTokens: tokenTracker.totalTokens,
    },
    modelsUsed: {
      vision: "muse-spark-1.3",
      segmentation: "sam-3.1",
    },
  });

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
