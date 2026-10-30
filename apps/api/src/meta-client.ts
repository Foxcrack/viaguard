import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  parseImageStream,
  recordsOfKind,
  decodeMaskToRaster,
  decodeMaskToSVGPath,
} from "@meta-sam/parser";
import {
  SceneUnderstanding,
  SceneUnderstandingSchema,
  StructuredReport,
  StructuredReportSchema,
  DamageFinding,
  DEFAULT_ROAD_CONCEPTS,
} from "@viaguard/core";

// Token Usage Tracker
export const tokenTracker = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  requestCount: 0,
  addUsage(usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
    if (!usage) return;
    this.totalPromptTokens += usage.prompt_tokens || 0;
    this.totalCompletionTokens += usage.completion_tokens || 0;
    this.totalTokens += usage.total_tokens || 0;
    this.requestCount++;
    console.log(
      `[Token Tracker] Request #${this.requestCount} consumed: ${usage.total_tokens || 0} tokens | Lifetime Total: ${this.totalTokens} tokens`
    );
  },
};

// Disk Cache Setup
const CACHE_DIR = path.resolve(process.cwd(), "data", "cache");
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(model: string, prompt: string, imageHash: string): string {
  return crypto
    .createHash("sha256")
    .update(`${model}:${prompt}:${imageHash}`)
    .digest("hex");
}

function getCachedResult<T>(key: string): T | null {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.warn(`[Cache Read Warning] Failed reading cache key ${key}:`, err);
  }
  return null;
}

function setCachedResult<T>(key: string, data: T): void {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[Cache Write Warning] Failed writing cache key ${key}:`, err);
  }
}

export function getMetaClient(): OpenAI {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "Missing MODEL_API_KEY environment variable. Please set MODEL_API_KEY in your .env file or environment."
    );
  }

  return new OpenAI({
    baseURL: process.env.META_API_BASE_URL || "https://api.meta.ai/v1",
    apiKey: apiKey.trim(),
  });
}

/**
 * Executes an async operation with exponential backoff on 429 and 5xx errors.
 * Rejects immediately without retry on 400, 401, and 404 errors.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const status = err?.status || err?.statusCode || 0;

      // Permanent non-retriable errors
      if (status === 400) {
        throw new Error(
          `[Meta API 400 Bad Request] The request was invalid: ${err.message}`
        );
      }
      if (status === 401) {
        throw new Error(
          `[Meta API 401 Unauthorized] Invalid or missing MODEL_API_KEY. Please verify your credentials.`
        );
      }
      if (status === 404) {
        throw new Error(
          `[Meta API 404 Model Not Found] Model identifier not found: ${err.message}`
        );
      }

      if (attempt >= maxRetries || (status !== 429 && status < 500)) {
        throw err;
      }

      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      console.warn(
        `[Meta API Retry] Status ${status}. Retrying attempt ${attempt}/${maxRetries} after ${backoffMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * Step 2: Scene Understanding with Muse Spark (muse-spark-1.3)
 */
export async function understandSceneWithMuseSpark(options: {
  imageBase64: string;
  imageHash: string;
  moduleType: "road" | "construction";
  mimeType?: string;
}): Promise<{ scene: SceneUnderstanding; isCached: boolean }> {
  const model = "muse-spark-1.3";
  const prompt =
    options.moduleType === "road"
      ? `You are an expert civic infrastructure engineer inspecting road conditions. Analyze this street image.
Return a strictly valid JSON object matching this schema:
{
  "scene_type": string (e.g. "asphalt road", "concrete highway", "residential street", "intersection"),
  "visible_damage_types": string[] (provide up to 4 SHORT noun phrases suitable as SAM concept prompts, e.g. ["pothole", "crack", "damaged road surface", "manhole cover"]),
  "overall_condition": string (e.g. "poor", "fair", "good", "critical"),
  "notes": string (concise visual observations)
}
Return only JSON with no markdown wrapping or preamble.`
      : `You are an expert construction site inspector. Analyze this construction site image.
Return a strictly valid JSON object matching this schema:
{
  "scene_type": string (e.g. "commercial building foundation", "roadwork zone", "bridge construction"),
  "visible_damage_types": string[] (provide up to 5 SHORT noun phrases suitable as SAM concept prompts, e.g. ["scaffolding", "concrete wall", "excavator", "steel rebar", "debris", "crack"]),
  "overall_condition": string (e.g. "active framing", "excavation", "structural installation"),
  "notes": string (concise visual observations)
}
Return only JSON with no markdown wrapping or preamble.`;

  const cacheKey = getCacheKey(model, prompt, options.imageHash);
  const cached = getCachedResult<SceneUnderstanding>(cacheKey);
  if (cached) {
    return { scene: cached, isCached: true };
  }

  const client = getMetaClient();
  const mime = options.mimeType || "image/jpeg";

  const runCall = async () => {
    const res: any = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: `data:${mime};base64,${options.imageBase64}`,
              detail: "auto",
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    } as any);

    tokenTracker.addUsage(res?.usage);
    const rawText = res?.output_text || res?.choices?.[0]?.message?.content || "";
    return rawText;
  };

  let rawJson = "";
  try {
    rawJson = await withRetry(runCall);
  } catch (err) {
    console.warn("[Muse Spark Step 2] API call failed, attempting retry:", err);
    rawJson = await withRetry(runCall, 1);
  }

  try {
    const parsed = JSON.parse(rawJson);
    const validated = SceneUnderstandingSchema.parse(parsed);
    setCachedResult(cacheKey, validated);
    return { scene: validated, isCached: false };
  } catch (parseError) {
    console.warn(
      "[Muse Spark Step 2] Failed to parse strict JSON. Falling back to default concepts.",
      parseError
    );
    const fallback: SceneUnderstanding = {
      scene_type: options.moduleType === "road" ? "paved road surface" : "construction zone",
      visible_damage_types:
        options.moduleType === "road"
          ? [...DEFAULT_ROAD_CONCEPTS]
          : ["scaffolding", "concrete wall", "debris"],
      overall_condition: "unspecified",
      notes: "Auto-fallback invoked due to non-JSON model response.",
    };
    return { scene: fallback, isCached: false };
  }
}

/**
 * Step 3: SAM 3.1 Segmentation for a single concept prompt
 */
export async function segmentConceptWithSAM(options: {
  concept: string;
  imageBase64: string;
  imageHash: string;
  imageWidth: number;
  imageHeight: number;
  mimeType?: string;
}): Promise<{ findings: DamageFinding[]; isCached: boolean }> {
  const model = "sam-3.1";
  const concept = options.concept.trim();
  const cacheKey = getCacheKey(model, `concept:${concept}`, options.imageHash);

  const cached = getCachedResult<DamageFinding[]>(cacheKey);
  if (cached) {
    return { findings: cached, isCached: true };
  }

  const client = getMetaClient();
  const mime = options.mimeType || "image/jpeg";

  const runSegmentation = async (): Promise<DamageFinding[]> => {
    const stream = (await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: concept, // Must be ONE short noun phrase
            },
            {
              type: "input_image",
              image_url: `data:${mime};base64,${options.imageBase64}`,
              detail: "auto",
            },
          ],
        },
      ],
      metadata: {
        mask_encoding: "one_bit",
        include_confidence: "true",
      },
      stream: true,
    } as any)) as any;

    const parsedStream = parseImageStream(stream);
    const result = await parsedStream.finalResult;

    const boxRecords = recordsOfKind(result.records, "box");
    const maskRecords = recordsOfKind(result.records, "mask");

    const totalImagePixels = Math.max(options.imageWidth * options.imageHeight, 1);
    const findings: DamageFinding[] = [];

    // Pair mask records with boxes or bounds
    for (let i = 0; i < maskRecords.length; i++) {
      const maskRec = maskRecords[i];
      const boxRec = boxRecords[i];

      // Decode 1-bit mask to row-major raster
      const raster = decodeMaskToRaster(maskRec.mask);
      let activePixels = 0;
      for (let p = 0; p < raster.length; p++) {
        if (raster[p] === 1) activePixels++;
      }

      // Convert mask to scalable SVG path
      let svgPath: string | undefined;
      try {
        svgPath = decodeMaskToSVGPath(maskRec.mask);
      } catch {
        // Fallback gracefully if SVG path generator encounters edge-case geometry
      }

      const relativeAreaPercent = Number(
        ((activePixels / totalImagePixels) * 100).toFixed(2)
      );

      const confidence =
        maskRec.confidence ?? boxRec?.confidence ?? 0.85;

      const boundingBox = boxRec
        ? {
            x1: boxRec.left,
            y1: boxRec.top,
            x2: boxRec.right,
            y2: boxRec.bottom,
            width: boxRec.right - boxRec.left,
            height: boxRec.bottom - boxRec.top,
          }
        : {
            x1: maskRec.bounds.left,
            y1: maskRec.bounds.top,
            x2: maskRec.bounds.right,
            y2: maskRec.bounds.bottom,
            width: maskRec.bounds.right - maskRec.bounds.left,
            height: maskRec.bounds.bottom - maskRec.bounds.top,
          };

      findings.push({
        id: `finding-${concept}-${i}-${Date.now()}`,
        concept,
        confidence: Number(confidence.toFixed(2)),
        relativeAreaPercent,
        boundingBox,
        svgPath,
        maskBounds: {
          left: maskRec.bounds.left,
          top: maskRec.bounds.top,
          right: maskRec.bounds.right,
          bottom: maskRec.bounds.bottom,
        },
        activePixels,
      });
    }

    return findings;
  };

  const findings = await withRetry(runSegmentation);
  setCachedResult(cacheKey, findings);
  return { findings, isCached: false };
}

/**
 * Step 5: Report Generation with Muse Spark (muse-spark-1.3)
 */
export async function writeReportWithMuseSpark(options: {
  module: "road" | "construction";
  scene: SceneUnderstanding;
  findings: DamageFinding[];
  severityScore: number;
  severityLevel: string;
  imageHash: string;
  constructionDiffSummary?: string;
}): Promise<{ report: StructuredReport; isCached: boolean }> {
  const model = "muse-spark-1.3";
  const findingsSummary = options.findings
    .map(
      (f) =>
        `- ${f.concept}: ${f.relativeAreaPercent}% relative frame area, confidence ${f.confidence}`
    )
    .join("\n");

  const prompt = `You are a municipal civil engineer authoring an official infrastructure inspection report.
Strictly adhere to the provided measurements. Do NOT invent damage or structural features that were not detected.

Scene Information:
- Scene Type: ${options.scene.scene_type}
- Overall Condition: ${options.scene.overall_condition}
- Inspector Notes: ${options.scene.notes}
- Computed Severity Score: ${options.severityScore}/100 (${options.severityLevel})

Detected Findings:
${findingsSummary || "None (No significant surface damage detected)"}
${
  options.constructionDiffSummary
    ? `\nConstruction Measurement Diff:\n${options.constructionDiffSummary}`
    : ""
}

Generate a concise, professional report formatted as JSON matching this schema:
{
  "title": string (e.g. "Municipal Road Damage Assessment: Main St"),
  "summary": string (clear 2-3 sentence overview citing the measured relative areas and hazard rating),
  "recommendedAction": string (actionable advice for city public works, e.g. cold patch, milling, repaving, or monitoring),
  "priority": "low" | "medium" | "high" | "critical",
  "estimatedUrgency": string (e.g. "Within 48 hours", "Scheduled maintenance within 30 days", "Routine monitoring"),
  "keyFindings": [
    {
      "concept": string,
      "description": string,
      "severity": "low" | "medium" | "high" | "critical"
    }
  ]
}
Return only JSON with no markdown wrapping.`;

  const cacheKey = getCacheKey(model, prompt, options.imageHash);
  const cached = getCachedResult<StructuredReport>(cacheKey);
  if (cached) {
    return { report: cached, isCached: true };
  }

  const client = getMetaClient();
  const runCall = async () => {
    const res: any = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    } as any);

    tokenTracker.addUsage(res?.usage);
    const rawText = res?.output_text || res?.choices?.[0]?.message?.content || "";
    return rawText;
  };

  const rawJson = await withRetry(runCall);
  const parsed = JSON.parse(rawJson);
  const validated = StructuredReportSchema.parse(parsed);

  setCachedResult(cacheKey, validated);
  return { report: validated, isCached: false };
}
