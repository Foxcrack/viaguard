import { loadEnv, SAMPLES_DIR, UPLOAD_DIR } from "./paths.js";
loadEnv();

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import * as fs from "fs";
import * as path from "path";
import { VERSION } from "@viaguard/core";
import { runRoadPipeline, runConstructionPipeline } from "./pipeline.js";
import { storage } from "./storage.js";
import { jobManager } from "./jobs.js";
import { generateHtmlReport } from "./html-report.js";
import { tokenTracker } from "./meta-client.js";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// 1. Health Endpoint
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    version: VERSION,
    service: "viaguard-api",
    timestamp: new Date().toISOString(),
    tokensTracked: tokenTracker.totalTokens,
    demoModeDefault: process.env.DEMO_MODE === "true",
    liveApiConfigured: Boolean(process.env.MODEL_API_KEY && process.env.MODEL_API_KEY.trim() !== ""),
    models: {
      vision: "muse-spark-1.3",
      segmentation: "sam-3.1",
    },
  });
});

// 2. Static File Serving for /uploads
app.get("/uploads/:filename", (c) => {
  const filename = c.req.param("filename");
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return c.text("File not found", 404);
  }

  const ext = path.extname(safeFilename).toLowerCase();
  let contentType = "application/octet-stream";
  if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
  else if (ext === ".png") contentType = "image/png";
  else if (ext === ".webp") contentType = "image/webp";

  const fileBuffer = fs.readFileSync(filePath);
  return new Response(fileBuffer, {
    headers: { "Content-Type": contentType },
  });
});

// 3. Demo Samples Endpoint
app.get("/api/demo/samples", (c) => {
  if (!fs.existsSync(SAMPLES_DIR)) {
    return c.json({ samples: [] });
  }

  const files = fs
    .readdirSync(SAMPLES_DIR)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

  const samples = files.map((fileName) => {
    const isConstruction = fileName.toLowerCase().includes("construction");
    const isAfter = fileName.toLowerCase().includes("after");
    return {
      id: fileName,
      fileName,
      url: `/samples/${fileName}`,
      module: isConstruction ? "construction" : "road",
      variant: isAfter ? "after" : "before",
      label: fileName
        .replace(/[-_]/g, " ")
        .replace(/\.[^/.]+$/, "")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
    };
  });

  return c.json({ samples });
});

// 4. Job Status & Polling Endpoint
app.get("/api/jobs/:id", (c) => {
  const id = c.req.param("id");
  const job = jobManager.getJob(id);
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }
  return c.json(job);
});

// 5. Server-Sent Events (SSE) Progress Stream
app.get("/api/jobs/:id/stream", async (c) => {
  const id = c.req.param("id");
  const job = jobManager.getJob(id);
  if (!job) {
    return c.text("Job not found", 404);
  }

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendUpdate = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendUpdate(job);

      let prevStep = job.step;
      let prevPercent = job.percent;

      const interval = setInterval(() => {
        const currentJob = jobManager.getJob(id);
        if (!currentJob) {
          clearInterval(interval);
          controller.close();
          return;
        }

        if (
          currentJob.step !== prevStep ||
          currentJob.percent !== prevPercent ||
          currentJob.status === "completed" ||
          currentJob.status === "failed"
        ) {
          prevStep = currentJob.step;
          prevPercent = currentJob.percent;
          sendUpdate(currentJob);
        }

        if (currentJob.status === "completed" || currentJob.status === "failed") {
          clearInterval(interval);
          controller.close();
        }
      }, 300);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// 6. Road Damage Analysis Endpoint
app.post("/api/road/analyze", async (c) => {
  try {
    const formData = await c.req.parseBody();
    const imageFile = formData["image"];

    if (!imageFile || !(imageFile instanceof Blob)) {
      return c.json({ error: "Missing required 'image' file in multipart form data." }, 400);
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const originalName = typeof (imageFile as any).name === "string" ? (imageFile as any).name : "road.jpg";

    let clientLocation: { latitude: number; longitude: number; source: "browser" | "manual" } | undefined;
    const latStr = formData["latitude"];
    const lngStr = formData["longitude"];
    const sourceStr = formData["source"];

    if (latStr && lngStr) {
      const lat = parseFloat(String(latStr));
      const lng = parseFloat(String(lngStr));
      if (!isNaN(lat) && !isNaN(lng)) {
        clientLocation = {
          latitude: lat,
          longitude: lng,
          source: sourceStr === "browser" ? "browser" : "manual",
        };
      }
    }

    const explicitDemoMode =
      formData["demoMode"] === "true" ||
      c.req.query("demoMode") === "true" ||
      process.env.DEMO_MODE === "true";

    const isAsync = c.req.query("async") === "true";

    if (isAsync) {
      const jobId = `job-road-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      jobManager.createJob(jobId);

      (async () => {
        try {
          jobManager.updateJob(jobId, { status: "processing", percent: 10 });
          const report = await runRoadPipeline({
            imageBuffer: buffer,
            originalName,
            clientLocation,
            demoMode: explicitDemoMode,
            onProgress: (step, percent) => {
              jobManager.updateJob(jobId, { step, percent });
            },
          });
          jobManager.updateJob(jobId, {
            status: "completed",
            percent: 100,
            step: "Complete",
            report,
          });
        } catch (err: any) {
          console.error(`[Job ${jobId} Failed]:`, err.message || err);
          jobManager.updateJob(jobId, {
            status: "failed",
            error: err.message || "Pipeline analysis failed.",
          });
        }
      })();

      return c.json({ jobId, status: "pending" });
    } else {
      const report = await runRoadPipeline({
        imageBuffer: buffer,
        originalName,
        clientLocation,
        demoMode: explicitDemoMode,
      });
      return c.json(report);
    }
  } catch (err: any) {
    console.error("[Road Analyze Error]:", err.message || err);
    return c.json({ error: err.message || "Failed to process road inspection." }, 500);
  }
});

// 7. Construction Progress Analysis Endpoint
app.post("/api/construction/analyze", async (c) => {
  try {
    const formData = await c.req.parseBody();
    const beforeFile = formData["before"];
    const afterFile = formData["after"];

    if (!beforeFile || !(beforeFile instanceof Blob) || !afterFile || !(afterFile instanceof Blob)) {
      return c.json(
        { error: "Missing required 'before' and 'after' images in multipart form data." },
        400
      );
    }

    const beforeBuffer = Buffer.from(await beforeFile.arrayBuffer());
    const afterBuffer = Buffer.from(await afterFile.arrayBuffer());

    const explicitDemoMode =
      formData["demoMode"] === "true" ||
      c.req.query("demoMode") === "true" ||
      process.env.DEMO_MODE === "true";

    const isAsync = c.req.query("async") === "true";

    if (isAsync) {
      const jobId = `job-const-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      jobManager.createJob(jobId);

      (async () => {
        try {
          jobManager.updateJob(jobId, { status: "processing", percent: 10 });
          const report = await runConstructionPipeline({
            beforeBuffer,
            afterBuffer,
            demoMode: explicitDemoMode,
            onProgress: (step, percent) => {
              jobManager.updateJob(jobId, { step, percent });
            },
          });
          jobManager.updateJob(jobId, {
            status: "completed",
            percent: 100,
            step: "Complete",
            report,
          });
        } catch (err: any) {
          console.error(`[Job ${jobId} Failed]:`, err.message || err);
          jobManager.updateJob(jobId, {
            status: "failed",
            error: err.message || "Pipeline analysis failed.",
          });
        }
      })();

      return c.json({ jobId, status: "pending" });
    } else {
      const report = await runConstructionPipeline({
        beforeBuffer,
        afterBuffer,
        demoMode: explicitDemoMode,
      });
      return c.json(report);
    }
  } catch (err: any) {
    console.error("[Construction Analyze Error]:", err.message || err);
    return c.json({ error: err.message || "Failed to process construction inspection." }, 500);
  }
});

// 8. List Reports Endpoint
app.get("/api/reports", async (c) => {
  const moduleParam = c.req.query("module");
  const severityParam = c.req.query("severity");
  const limitParam = parseInt(c.req.query("limit") || "100", 10);

  const reports = await storage.list({
    module: moduleParam,
    severity: severityParam,
    limit: limitParam,
  });

  return c.json({ reports });
});

// 9. Single Report Endpoint
app.get("/api/reports/:id", async (c) => {
  const id = c.req.param("id");
  const report = await storage.getById(id);

  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  return c.json(report);
});

// 10. Printable Export Endpoint (HTML or JSON)
app.get("/api/reports/:id/export", async (c) => {
  const id = c.req.param("id");
  const report = await storage.getById(id);

  if (!report) {
    return c.text("Report not found", 404);
  }

  const format = c.req.query("format");
  if (format === "json") {
    return c.json(report);
  }

  const html = generateHtmlReport(report);
  return c.html(html);
});

// Server Initialization
const port = Number(process.env.PORT) || 3001;

if (process.env.NODE_ENV !== "test") {
  console.log(`Viaguard API server running on http://localhost:${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}
