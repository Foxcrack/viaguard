import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../src/index.js";
import { storage } from "../src/storage.js";
import { applyPrivacyBlur } from "../src/pipeline.js";
import { createStructuredResponse, understandSceneWithMuseSpark } from "../src/meta-client.js";
import sharp from "sharp";
import {
  InspectionReport,
  DamageFinding,
  SceneUnderstandingSchema,
  DEFAULT_ROAD_CONCEPTS,
} from "@viaguard/core";

describe("Viaguard Backend API Endpoints", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
  });

  it("GET /api/health returns status ok with version and model information", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.version).toBe("0.1.0");
    expect(data.models.vision).toBe("muse-spark-1.3");
    expect(data.models.segmentation).toBe("sam-3.1");
    expect(typeof data.demoModeDefault).toBe("boolean");
    expect(data.privacyBlurDefault).toBe(true);
  });

  it("GET /api/demo/samples returns bundled sample images", async () => {
    const res = await app.request("/api/demo/samples");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.samples)).toBe(true);
    expect(data.samples.length).toBeGreaterThan(0);
    const first = data.samples[0];
    expect(first).toHaveProperty("url");
    expect(first).toHaveProperty("module");
  });

  it("POST /api/road/analyze rejects requests without image file", async () => {
    const formData = new FormData();
    const res = await app.request("/api/road/analyze", {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required 'image'");
  });

  it("POST /api/road/analyze never silently activates demo mode when MODEL_API_KEY is missing", async () => {
    const prevKey = process.env.MODEL_API_KEY;
    const prevDemo = process.env.DEMO_MODE;
    delete process.env.MODEL_API_KEY;
    process.env.DEMO_MODE = "false";

    try {
      const imgBuf = await sharp({
        create: { width: 120, height: 120, channels: 3, background: { r: 60, g: 60, b: 60 } },
      })
        .jpeg()
        .toBuffer();

      const formData = new FormData();
      formData.append("image", new Blob([imgBuf], { type: "image/jpeg" }), "road-sample-pothole.jpg");

      const res = await app.request("/api/road/analyze", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain("MODEL_API_KEY");
    } finally {
      if (prevKey !== undefined) process.env.MODEL_API_KEY = prevKey;
      if (prevDemo !== undefined) process.env.DEMO_MODE = prevDemo;
    }
  });

  it("POST /api/road/analyze in explicit demoMode rejects unrecorded images instead of faking data", async () => {
    const imgBuf = await sharp({
      create: { width: 111, height: 111, channels: 3, background: { r: 42, g: 55, b: 68 } },
    })
      .jpeg()
      .toBuffer();

    const formData = new FormData();
    formData.append("image", new Blob([imgBuf], { type: "image/jpeg" }), "unrecorded.jpg");
    formData.append("demoMode", "true");

    const res = await app.request("/api/road/analyze", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("No cached real API response");
  });

  it("POST /api/construction/analyze rejects requests without before/after images", async () => {
    const formData = new FormData();
    const res = await app.request("/api/construction/analyze", {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required 'before' and 'after'");
  });

  it("GET /api/reports returns persistent reports list", async () => {
    const res = await app.request("/api/reports");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.reports)).toBe(true);
  });

  it("GET /api/reports/:id/export returns printable HTML report", async () => {
    const mockReport: InspectionReport = {
      id: "test-rep-export-1",
      module: "road",
      createdAt: new Date().toISOString(),
      imageUrl: "/samples/road-sample-pothole.jpg",
      imageWidth: 800,
      imageHeight: 600,
      sceneType: "asphalt road",
      overallCondition: "poor",
      severityScore: 78,
      severityLevel: "high",
      findings: [
        {
          id: "f-1",
          concept: "pothole",
          confidence: 0.94,
          relativeAreaPercent: 8.5,
          boundingBox: { x1: 100, y1: 150, x2: 400, y2: 350, width: 300, height: 200 },
        },
      ],
      title: "Municipal Road Damage Assessment: Test St",
      summary: "Significant asphalt loss identified on eastbound lane.",
      recommendedAction: "Cold patch void immediately and schedule repaving.",
      estimatedUrgency: "Within 48 hours",
      isCached: false,
    };

    await storage.save(mockReport);

    const resHtml = await app.request(`/api/reports/${mockReport.id}/export`);
    expect(resHtml.status).toBe(200);
    const htmlText = await resHtml.text();
    expect(htmlText).toContain("Official Inspection Report");
    expect(htmlText).toContain("HIGH SEVERITY (78/100)");
    expect(htmlText).toContain("Cold patch void immediately");
    expect(htmlText).toContain("Privacy blur: on");

    const resJson = await app.request(`/api/reports/${mockReport.id}/export?format=json`);
    expect(resJson.status).toBe(200);
    const jsonData = await resJson.json();
    expect(jsonData.id).toBe(mockReport.id);
    expect(jsonData.severityScore).toBe(78);
  });

  it("GET /api/reports/:id returns 404 for unknown report", async () => {
    const res = await app.request("/api/reports/nonexistent-id-999");
    expect(res.status).toBe(404);
  });

  it("applyPrivacyBlur blurs both 'person' and 'license plate' regions in the image without altering dimensions", async () => {
    const width = 400;
    const height = 300;
    // Build raw RGB image with high-contrast bright white rectangles for person & license plate against dark gray background
    const rawPixels = Buffer.alloc(width * height * 3, 40);
    // Person sharp detail at [60..110, 80..200] (checkerboard high frequency)
    for (let y = 80; y < 200; y++) {
      for (let x = 60; x < 110; x++) {
        const val = (x + y) % 2 === 0 ? 250 : 10;
        const idx = (y * width + x) * 3;
        rawPixels[idx] = val;
        rawPixels[idx + 1] = val;
        rawPixels[idx + 2] = val;
      }
    }
    // Small license plate sharp detail at [250..274, 40..52]
    for (let y = 40; y < 52; y++) {
      for (let x = 250; x < 274; x++) {
        const val = x % 2 === 0 ? 255 : 0;
        const idx = (y * width + x) * 3;
        rawPixels[idx] = val;
        rawPixels[idx + 1] = val;
        rawPixels[idx + 2] = val;
      }
    }

    const rawBuffer = await sharp(rawPixels, {
      raw: { width, height, channels: 3 },
    })
      .png()
      .toBuffer();

    const privacyFindings: DamageFinding[] = [
      {
        id: "privacy-person-1",
        concept: "person",
        confidence: 0.88,
        relativeAreaPercent: 5.0,
        boundingBox: { x1: 60, y1: 80, x2: 110, y2: 200, width: 50, height: 120 },
      },
      {
        id: "privacy-plate-1",
        concept: "license plate",
        confidence: 0.62,
        relativeAreaPercent: 0.24,
        boundingBox: { x1: 250, y1: 40, x2: 274, y2: 52, width: 24, height: 12 },
      },
    ];

    const blurredBuffer = await applyPrivacyBlur(rawBuffer, privacyFindings);
    expect(blurredBuffer.length).toBeGreaterThan(0);

    const meta = await sharp(blurredBuffer).metadata();
    expect(meta.width).toBe(width);
    expect(meta.height).toBe(height);

    const { data: afterRaw, info } = await sharp(blurredBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Verify high-frequency checkerboard contrast inside person & plate boxes was smoothed out by blur
    const neighborDiff = (buf: Buffer, channels: number, x: number, y: number) => {
      const i1 = (y * width + x) * channels;
      const i2 = (y * width + (x + 1)) * channels;
      return Math.abs(buf[i1] - buf[i2]);
    };

    expect(neighborDiff(rawPixels, 3, 80, 140)).toBe(240);
    expect(neighborDiff(afterRaw, info.channels, 80, 140)).toBeLessThan(20);

    expect(neighborDiff(rawPixels, 3, 260, 46)).toBe(255);
    expect(neighborDiff(afterRaw, info.channels, 260, 46)).toBeLessThan(20);

    // Outside unblurred background corner [380, 280] stays untouched
    const cornerIdx = (280 * width + 380) * info.channels;
    expect(afterRaw[cornerIdx]).toBe(40);
  });

  it("understandSceneWithMuseSpark strips adjectives and multi-word road-marking phrases from suggested concepts", async () => {
    const fakeClient: any = {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            scene_type: "urban crosswalk",
            visible_damage_types: [
              "pothole",
              "cracked road marking",
              "damaged road surface",
              "patch",
              "manhole cover",
            ],
            overall_condition: "poor",
            notes: "Pothole near crosswalk",
          }),
        }),
      },
    };

    const { scene } = await understandSceneWithMuseSpark({
      imageBase64: "dGVzdA==",
      imageHash: "test-sanitize-scene-concepts",
      moduleType: "road",
      clientOverride: fakeClient,
    });

    expect(scene.visible_damage_types).toEqual(["pothole", "patch", "manhole cover"]);
  });

  it("createStructuredResponse sends Responses API text.format json_schema (never response_format) and retries once on invalid JSON", async () => {
    const capturedPayloads: any[] = [];
    let callCount = 0;

    const fakeClient: any = {
      responses: {
        create: async (payload: any) => {
          capturedPayloads.push(payload);
          callCount++;
          if (callCount === 1) {
            return { output_text: "{not-valid-json", usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } };
          }
          return {
            output_text: JSON.stringify({
              scene_type: "asphalt street",
              visible_damage_types: ["pothole", "crack"],
              overall_condition: "poor",
              notes: "Cracked asphalt",
            }),
            usage: { input_tokens: 12, output_tokens: 18, total_tokens: 30 },
          };
        },
      },
    };

    const result = await createStructuredResponse({
      model: "muse-spark-1.3",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "test" }] }],
      schemaName: "scene_understanding",
      jsonSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
      zodSchema: SceneUnderstandingSchema,
      reasoningEffort: "low",
      clientOverride: fakeClient,
    });

    expect(callCount).toBe(2);
    expect(capturedPayloads[0]).not.toHaveProperty("response_format");
    expect(capturedPayloads[0].text.format).toMatchObject({
      type: "json_schema",
      name: "scene_understanding",
      strict: true,
    });
    expect(capturedPayloads[0].reasoning).toEqual({ effort: "low" });
    expect(result.scene_type).toBe("asphalt street");
  });

  it("understandSceneWithMuseSpark falls back to DEFAULT_ROAD_CONCEPTS if model returns invalid JSON twice", async () => {
    let calls = 0;
    const fakeClient: any = {
      responses: {
        create: async () => {
          calls++;
          return { output_text: "invalid json output" };
        },
      },
    };

    const { scene, isCached } = await understandSceneWithMuseSpark({
      imageBase64: "dGVzdA==",
      imageHash: "test-invalid-json-fallback",
      moduleType: "road",
      clientOverride: fakeClient,
    });

    expect(calls).toBe(2);
    expect(isCached).toBe(false);
    expect(scene.visible_damage_types).toEqual([...DEFAULT_ROAD_CONCEPTS]);
  });
});
