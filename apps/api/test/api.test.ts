import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../src/index.js";
import { storage } from "../src/storage.js";
import { InspectionReport } from "@viaguard/core";

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

    // Test HTML export
    const resHtml = await app.request(`/api/reports/${mockReport.id}/export`);
    expect(resHtml.status).toBe(200);
    const htmlText = await resHtml.text();
    expect(htmlText).toContain("Official Inspection Report");
    expect(htmlText).toContain("HIGH SEVERITY (78/100)");
    expect(htmlText).toContain("Cold patch void immediately");

    // Test JSON export
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
});
