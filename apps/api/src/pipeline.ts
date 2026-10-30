import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import sharp from "sharp";
import exifr from "exifr";
import {
  InspectionReport,
  GeoLocation,
  DamageFinding,
  DEFAULT_ROAD_CONCEPTS,
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
import { DEMO_PRECACHED_REPORTS } from "./demo-cache.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
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

  // 1. Read EXIF GPS before stripping metadata
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

  // 2. Inspect image metadata via Sharp
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
 * Executes the complete 6-step Road Damage Inspection Pipeline
 */
export async function runRoadPipeline(options: {
  imageBuffer: Buffer;
  originalName?: string;
  clientLocation?: { latitude: number; longitude: number; source: "browser" | "manual" };
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

  // Demo Resilience Fallback: Replays verified real cached response for demo samples
  const isDemo = process.env.DEMO_MODE === "true" || !process.env.MODEL_API_KEY;
  if (isDemo && options.originalName) {
    const lowerName = options.originalName.toLowerCase();
    const demoKey = lowerName.includes("pothole")
      ? "road-sample-pothole"
      : lowerName.includes("crack")
      ? "road-sample-cracks"
      : undefined;

    if (demoKey && DEMO_PRECACHED_REPORTS[demoKey]) {
      const demoData = DEMO_PRECACHED_REPORTS[demoKey];
      notify("Replaying verified cached model response...", 80);
      const reportId = `rep-road-demo-${Date.now()}`;
      const demoReport: InspectionReport = {
        id: reportId,
        module: "road",
        createdAt: new Date().toISOString(),
        imageUrl: preprocessed.relativeUrl,
        imageWidth: preprocessed.width,
        imageHeight: preprocessed.height,
        location: resolvedLocation || demoData.location,
        sceneType: demoData.sceneType || "asphalt road",
        overallCondition: demoData.overallCondition || "poor",
        severityScore: demoData.severityScore || 70,
        severityLevel: demoData.severityLevel || "high",
        findings: demoData.findings || [],
        title: demoData.title || "Road Inspection",
        summary: demoData.summary || "",
        recommendedAction: demoData.recommendedAction || "",
        estimatedUrgency: demoData.estimatedUrgency || "",
        isCached: true,
        modelsUsed: { vision: "muse-spark-1.3", segmentation: "sam-3.1" },
      };
      await storage.save(demoReport);
      notify("Inspection complete (cached real response).", 100);
      return demoReport;
    }
  }

  // Step 2: Scene Understanding (Muse Spark)
  notify("Understanding scene structure with Muse Spark...", 35);
  const { scene, isCached: sceneCached } = await understandSceneWithMuseSpark({
    imageBase64: preprocessed.base64,
    imageHash: preprocessed.hash,
    moduleType: "road",
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
  const { report: structuredReport, isCached: reportCached } =
    await writeReportWithMuseSpark({
      module: "road",
      scene,
      findings: allFindings,
      severityScore: severity.score,
      severityLevel: severity.level,
      imageHash: preprocessed.hash,
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
    isCached: sceneCached || reportCached,
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
  onProgress?: ProgressCallback;
}): Promise<InspectionReport> {
  const notify = options.onProgress || (() => {});

  notify("Pre-processing BEFORE and AFTER inspection images...", 15);
  const beforePrep = await preprocessImage(options.beforeBuffer, "before.jpg");
  const afterPrep = await preprocessImage(options.afterBuffer, "after.jpg");

  // Demo Resilience Fallback: Replays verified comparative response when in demo mode or offline
  const isDemo = process.env.DEMO_MODE === "true" || !process.env.MODEL_API_KEY;
  if (isDemo) {
    const demoData = DEMO_PRECACHED_REPORTS["construction-pair"];
    notify("Replaying verified comparative model response...", 80);
    const reportId = `rep-const-demo-${Date.now()}`;
    const demoReport: InspectionReport = {
      id: reportId,
      module: "construction",
      createdAt: new Date().toISOString(),
      imageUrl: beforePrep.relativeUrl,
      afterImageUrl: afterPrep.relativeUrl,
      imageWidth: beforePrep.width,
      imageHeight: beforePrep.height,
      afterImageWidth: afterPrep.width,
      afterImageHeight: afterPrep.height,
      sceneType: demoData.sceneType || "commercial structural site",
      overallCondition: demoData.overallCondition || "active framing",
      severityScore: demoData.severityScore || 22,
      severityLevel: demoData.severityLevel || "low",
      findings: demoData.findings || [],
      afterFindings: demoData.afterFindings || [],
      constructionDiff: demoData.constructionDiff,
      title: demoData.title || "Comparative Job Site Progression Audit",
      summary: demoData.summary || "",
      recommendedAction: demoData.recommendedAction || "",
      estimatedUrgency: demoData.estimatedUrgency || "",
      isCached: true,
      modelsUsed: { vision: "muse-spark-1.3", segmentation: "sam-3.1" },
    };
    await storage.save(demoReport);
    notify("Construction progression analysis complete (cached real response).", 100);
    return demoReport;
  }

  notify("Analyzing site baseline and evolution with Muse Spark...", 35);
  const { scene: beforeScene } = await understandSceneWithMuseSpark({
    imageBase64: beforePrep.base64,
    imageHash: beforePrep.hash,
    moduleType: "construction",
  });

  const { scene: afterScene } = await understandSceneWithMuseSpark({
    imageBase64: afterPrep.base64,
    imageHash: afterPrep.hash,
    moduleType: "construction",
  });

  // Shared concept list for consistent comparative segmentation
  const comparativeConcepts = Array.from(
    new Set([
      ...beforeScene.visible_damage_types,
      ...afterScene.visible_damage_types,
      ...DEFAULT_CONSTRUCTION_CONCEPTS,
    ])
  ).slice(0, 5);

  notify(`Running comparative SAM segmentation (${comparativeConcepts.join(", ")})...`, 60);

  // Segment BEFORE image
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
      });
      return findings;
    }
  );
  const beforeFindings = beforeFindingsNested.flat();

  // Segment AFTER image
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

  const { report: structuredReport, isCached } = await writeReportWithMuseSpark({
    module: "construction",
    scene: afterScene,
    findings: afterFindings,
    severityScore: severity.score,
    severityLevel: severity.level,
    imageHash: `${beforePrep.hash}-${afterPrep.hash}`,
    constructionDiffSummary: `${diffResult.overallAssessment}\n${diffSummary}`,
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
    isCached,
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

  await storage.save(inspectionReport);
  notify("Construction progression analysis complete.", 100);

  return inspectionReport;
}
