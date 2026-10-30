import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { z } from "zod";
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
  CandidateFinding,
  DEFAULT_ROAD_CONCEPTS,
  DEFAULT_CONSTRUCTION_CONCEPTS,
  sanitizeConcept,
} from "@viaguard/core";
import { CACHE_DIR } from "./paths.js";

// Token Usage Tracker (supports both Responses API input_tokens/output_tokens and Chat Completions fields)
export const tokenTracker = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  requestCount: 0,
  addUsage(usage?: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  }) {
    if (!usage) return;
    const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
    this.totalPromptTokens += inputTokens;
    this.totalCompletionTokens += outputTokens;
    this.totalTokens += totalTokens;
    this.requestCount++;
    console.log(
      `[Token Tracker] Request #${this.requestCount} consumed: ${totalTokens} tokens (in=${inputTokens}, out=${outputTokens}) | Lifetime Total: ${this.totalTokens} tokens`
    );
  },
};

interface VerifiedCacheEnvelope<T> {
  recordedFromLiveApi: true;
  recordedAt: string;
  model: string;
  imageHash: string;
  payload: T;
}

class StructuredOutputValidationError extends Error {
  constructor(message: string, public readonly rawOutput: string) {
    super(message);
    this.name = "StructuredOutputValidationError";
  }
}

const SCENE_UNDERSTANDING_JSON_SCHEMA = {
  type: "object",
  properties: {
    scene_type: {
      type: "string",
      description: "Classification of the street or construction scene",
    },
    visible_damage_types: {
      type: "array",
      items: {
        type: "string",
        description:
          "Strictly 1 or 2 words, plain nouns only (e.g. 'pothole', 'crack', 'patch', 'manhole cover'). Never use adjectives like 'cracked' or 'damaged', never exceed 2 words, and never output 'road marking'.",
      },
      description:
        "List of 1-to-2-word plain nouns only suitable as single-concept SAM 3.1 prompts",
    },
    overall_condition: {
      type: "string",
      description: "Overall physical condition rating",
    },
    notes: {
      type: "string",
      description: "Concise visual engineering observations",
    },
  },
  required: ["scene_type", "visible_damage_types", "overall_condition", "notes"],
  additionalProperties: false,
} as const;

const STRUCTURED_REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    recommendedAction: { type: "string" },
    priority: {
      type: "string",
      enum: ["low", "medium", "high", "critical"],
    },
    estimatedUrgency: { type: "string" },
    keyFindings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concept: { type: "string" },
          description: { type: "string" },
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
        },
        required: ["concept", "description", "severity"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "title",
    "summary",
    "recommendedAction",
    "priority",
    "estimatedUrgency",
    "keyFindings",
  ],
  additionalProperties: false,
} as const;

function ensureCacheDir(): void {
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

function getVerifiedCachedResult<T>(key: string): T | null {
  try {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<VerifiedCacheEnvelope<T>>;
    if (parsed && parsed.recordedFromLiveApi === true && parsed.payload !== undefined) {
      return parsed.payload;
    }
  } catch (err) {
    console.warn(`[Cache Read Warning] Failed reading cache key ${key}:`, err);
  }
  return null;
}

function setVerifiedCachedResult<T>(
  key: string,
  model: string,
  imageHash: string,
  payload: T
): void {
  try {
    ensureCacheDir();
    const envelope: VerifiedCacheEnvelope<T> = {
      recordedFromLiveApi: true,
      recordedAt: new Date().toISOString(),
      model,
      imageHash,
      payload,
    };
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[Cache Write Warning] Failed writing cache key ${key}:`, err);
  }
}

function stripMarkdownJsonFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

function extractResponsesOutputText(res: any): string {
  if (typeof res?.output_text === "string" && res.output_text.trim().length > 0) {
    return res.output_text;
  }
  if (Array.isArray(res?.output)) {
    const chunks: string[] = [];
    for (const item of res.output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.type === "output_text" && typeof part.text === "string") {
            chunks.push(part.text);
          }
        }
      }
    }
    if (chunks.length > 0) {
      return chunks.join("");
    }
  }
  return "";
}

export function getMetaClient(): OpenAI {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "Missing MODEL_API_KEY environment variable. Set MODEL_API_KEY in .env at the project root to run live Meta Model API calls."
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
 * Single centralized helper for Responses API JSON-Schema structured outputs (`text.format`).
 * Validates the response with Zod and retries once if the model emits invalid JSON.
 */
export async function createStructuredResponse<T>(options: {
  model: string;
  input: Array<{
    type: "message";
    role: "user" | "system" | "developer";
    content: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string }
    >;
  }>;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: z.ZodType<T, z.ZodTypeDef, unknown>;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  clientOverride?: OpenAI;
}): Promise<T> {
  const client = options.clientOverride ?? getMetaClient();
  const maxValidationAttempts = 2; // Initial attempt + 1 retry if JSON/Zod validation fails
  let lastValidationErr: StructuredOutputValidationError | null = null;

  for (let attempt = 1; attempt <= maxValidationAttempts; attempt++) {
    const rawText = await withRetry(async () => {
      const res: any = await client.responses.create({
        model: options.model,
        input: options.input,
        ...(options.reasoningEffort
          ? { reasoning: { effort: options.reasoningEffort } }
          : {}),
        text: {
          format: {
            type: "json_schema",
            name: options.schemaName,
            schema: options.jsonSchema,
            strict: true,
          },
        },
      } as any);

      tokenTracker.addUsage(res?.usage);
      return extractResponsesOutputText(res);
    });

    try {
      const cleaned = stripMarkdownJsonFences(rawText);
      const parsed = JSON.parse(cleaned);
      return options.zodSchema.parse(parsed);
    } catch (parseErr: any) {
      lastValidationErr = new StructuredOutputValidationError(
        `Invalid structured JSON from ${options.model} (${options.schemaName}) on attempt ${attempt}/${maxValidationAttempts}: ${parseErr?.message || parseErr}`,
        rawText
      );
      if (attempt < maxValidationAttempts) {
        console.warn(`[Structured Output Retry] ${lastValidationErr.message}. Retrying once...`);
      }
    }
  }

  throw lastValidationErr!;
}

/**
 * Step 2: Scene Understanding with Muse Spark (muse-spark-1.3)
 */
export async function understandSceneWithMuseSpark(options: {
  imageBase64: string;
  imageHash: string;
  moduleType: "road" | "construction";
  mimeType?: string;
  useCache?: boolean;
  recordToCache?: boolean;
  clientOverride?: OpenAI;
}): Promise<{ scene: SceneUnderstanding; isCached: boolean }> {
  const model = "muse-spark-1.3";
  const prompt =
    options.moduleType === "road"
      ? `You are an expert civic infrastructure engineer inspecting road conditions. Analyze this street image.
Return a JSON object matching the schema with:
- "scene_type": e.g. "asphalt road", "concrete highway", "residential street", "intersection"
- "visible_damage_types": up to 4 concepts for SAM 3.1 segmentation. STRICT RULES: each item MUST be 1 or 2 words, plain nouns ONLY (e.g. ["pothole", "crack", "patch", "manhole cover", "sinkhole", "debris"]). NEVER output 3+ words, NEVER include adjectives or participles like "cracked", "damaged", "broken", or "worn", and NEVER output paint or background labels like "road marking" or "road surface".
- "overall_condition": e.g. "poor", "fair", "good", "critical"
- "notes": concise visual observations`
      : `You are an expert construction site inspector. Analyze this construction site image.
Return a JSON object matching the schema with:
- "scene_type": e.g. "commercial building foundation", "roadwork zone", "bridge construction"
- "visible_damage_types": up to 5 concepts for SAM 3.1 segmentation. STRICT RULES: each item MUST be 1 or 2 words, plain nouns ONLY (e.g. ["scaffolding", "concrete wall", "excavator", "steel rebar", "debris", "crack"]). NEVER output 3+ words and NEVER include adjectives like "damaged", "cracked", or "exposed".
- "overall_condition": e.g. "active framing", "excavation", "structural installation"
- "notes": concise visual observations`;

  const cacheKey = getCacheKey(model, prompt, options.imageHash);

  if (options.useCache) {
    const cached = getVerifiedCachedResult<SceneUnderstanding>(cacheKey);
    if (!cached) {
      throw new Error(
        "No cached real API response found in data/cache/ for this image. Set MODEL_API_KEY in .env and run 'pnpm record:demo <image>' first, or turn off Demo Mode."
      );
    }
    const sanitizedCached: SceneUnderstanding = {
      ...cached,
      visible_damage_types: Array.from(
        new Set(
          cached.visible_damage_types
            .map((c) => sanitizeConcept(c))
            .filter((c): c is string => c !== null)
        )
      ),
    };
    return { scene: sanitizedCached, isCached: true };
  }

  const mime = options.mimeType || "image/jpeg";

  try {
    const validated = await createStructuredResponse({
      model,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: `data:${mime};base64,${options.imageBase64}`,
            },
          ],
        },
      ],
      schemaName: "scene_understanding",
      jsonSchema: SCENE_UNDERSTANDING_JSON_SCHEMA,
      zodSchema: SceneUnderstandingSchema,
      reasoningEffort: "low",
      clientOverride: options.clientOverride,
    });

    const sanitizedScene: SceneUnderstanding = {
      ...validated,
      visible_damage_types: Array.from(
        new Set(
          validated.visible_damage_types
            .map((c) => sanitizeConcept(c))
            .filter((c): c is string => c !== null)
        )
      ),
    };

    if (options.recordToCache) {
      setVerifiedCachedResult(cacheKey, model, options.imageHash, sanitizedScene);
    }

    return { scene: sanitizedScene, isCached: false };
  } catch (err) {
    // Only fall back to default concepts when the live model returned malformed JSON after 1 retry;
    // propagate HTTP/auth/network errors directly.
    if (err instanceof StructuredOutputValidationError) {
      console.warn(
        `[Scene Understanding Fallback] Falling back to default ${options.moduleType} concepts after invalid JSON retry: ${err.message}`
      );
      const fallbackScene: SceneUnderstanding = {
        scene_type: options.moduleType === "road" ? "roadway surface" : "construction site",
        visible_damage_types:
          options.moduleType === "road"
            ? [...DEFAULT_ROAD_CONCEPTS]
            : [...DEFAULT_CONSTRUCTION_CONCEPTS],
        overall_condition: "inspection pending",
        notes: "Fallback to default SAM 3.1 concepts after non-conforming scene JSON.",
      };
      return { scene: fallbackScene, isCached: false };
    }
    throw err;
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
  useCache?: boolean;
  recordToCache?: boolean;
}): Promise<{ findings: CandidateFinding[]; isCached: boolean }> {
  const model = "sam-3.1";
  const concept = options.concept.trim();
  const cacheKey = getCacheKey(model, `concept:${concept}`, options.imageHash);

  if (options.useCache) {
    const cached = getVerifiedCachedResult<DamageFinding[]>(cacheKey);
    if (!cached) {
      throw new Error(
        `No cached real SAM 3.1 response found in data/cache/ for concept "${concept}". Run 'pnpm record:demo <image>' with MODEL_API_KEY set first.`
      );
    }
    return { findings: cached, isCached: true };
  }

  const client = getMetaClient();
  const mime = options.mimeType || "image/jpeg";

  const runSegmentation = async (): Promise<CandidateFinding[]> => {
    const stream = (await client.responses.create({
      model,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: concept, // Must be ONE short noun phrase
            },
            {
              type: "input_image",
              image_url: `data:${mime};base64,${options.imageBase64}`,
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
    const findings: CandidateFinding[] = [];

    for (let i = 0; i < maskRecords.length; i++) {
      const maskRec = maskRecords[i];
      const boxRec = boxRecords[i];

      const raster = decodeMaskToRaster(maskRec.mask);
      let activePixels = 0;
      for (let p = 0; p < raster.length; p++) {
        if (raster[p] === 1) activePixels++;
      }

      let svgPath: string | undefined;
      try {
        svgPath = decodeMaskToSVGPath(maskRec.mask);
      } catch {
        // Fallback gracefully if SVG path generator encounters edge-case geometry
      }

      const relativeAreaPercent = Number(
        ((activePixels / totalImagePixels) * 100).toFixed(2)
      );

      const confidence = maskRec.confidence ?? boxRec?.confidence ?? 0.85;

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
        maskRaster: raster,
      });
    }

    return findings;
  };

  const findings = await withRetry(runSegmentation);
  if (options.recordToCache) {
    const serializableFindings: DamageFinding[] = findings.map(
      ({ maskRaster: _maskRaster, ...rest }) => rest
    );
    setVerifiedCachedResult(cacheKey, model, options.imageHash, serializableFindings);
  }
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
  useCache?: boolean;
  recordToCache?: boolean;
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

Generate a concise, professional municipal inspection report matching the requested JSON schema.`;

  const cacheKey = getCacheKey(model, prompt, options.imageHash);

  if (options.useCache) {
    const cached = getVerifiedCachedResult<StructuredReport>(cacheKey);
    if (!cached) {
      throw new Error(
        "No cached real Muse Spark report found in data/cache/ for this image. Run 'pnpm record:demo <image>' with MODEL_API_KEY set first."
      );
    }
    return { report: cached, isCached: true };
  }

  const validated = await createStructuredResponse({
    model,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ],
    schemaName: "structured_inspection_report",
    jsonSchema: STRUCTURED_REPORT_JSON_SCHEMA,
    zodSchema: StructuredReportSchema,
    reasoningEffort: "low",
  });

  if (options.recordToCache) {
    setVerifiedCachedResult(cacheKey, model, options.imageHash, validated);
  }
  return { report: validated, isCached: false };
}
