import { loadEnv, SAMPLES_DIR, UPLOAD_DIR } from "./paths.js";
loadEnv();

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import * as fs from "fs";
import * as path from "path";
import { VERSION, normalizeInspectionReport } from "@viaguard/core";
import { runRoadPipeline, runConstructionPipeline } from "./pipeline.js";
import { storage } from "./storage.js";
import { jobManager } from "./jobs.js";
import { generateHtmlReport } from "./html-report.js";
import { tokenTracker } from "./meta-client.js";

/**
 * Sanitizes error messages by scrubbing API keys, tokens and credentials before logging.
 */
export function sanitizeError(err: unknown): string {
  const text =
    err instanceof Error
      ? `${err.name}: ${err.message}\n${err.stack || ""}`
      : typeof err === "object" && err !== null
      ? JSON.stringify(err)
      : String(err);

  let sanitized = text;
  const apiKey = process.env.MODEL_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    sanitized = sanitized.replaceAll(apiKey, "[REDACTED_API_KEY]");
  }
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]");
  sanitized = sanitized.replace(
    /("?(?:api[_-]?key|authorization|secret|token|password)"?\s*[:=]\s*)"[^"]+"/gi,
    '$1"[REDACTED]"'
  );
  return sanitized;
}

/**
 * Identifies whether an error is a non-fatal stream/socket disconnect error.
 */
export function isNonFatalStreamError(err: unknown): boolean {
  if (!err) return false;
  const errorObj = err as any;
  const code = String(errorObj?.code || "");
  const message = String(errorObj?.message || errorObj || "");
  const name = String(errorObj?.name || "");

  return (
    code === "ERR_INVALID_STATE" ||
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ECANCELED" ||
    name === "AbortError" ||
    message.includes("Controller is already closed") ||
    message.includes("Invalid state: Controller") ||
    message.includes("premature close") ||
    message.includes("stream closed") ||
    message.includes("client disconnected")
  );
}

// Global Process Error Handlers to keep server alive on non-fatal stream/client disconnect errors
process.on("unhandledRejection", (reason) => {
  const sanitized = sanitizeError(reason);
  if (isNonFatalStreamError(reason)) {
    console.warn(`[Process Warning] Non-fatal unhandled stream rejection suppressed:\n${sanitized}`);
    return;
  }
  console.error(`[Process Error] Unhandled rejection:\n${sanitized}`);
});

process.on("uncaughtException", (error, origin) => {
  const sanitized = sanitizeError(error);
  if (isNonFatalStreamError(error)) {
    console.warn(`[Process Warning] Non-fatal uncaught stream exception suppressed (${origin}):\n${sanitized}`);
    return;
  }
  console.error(`[Fatal Process Error] Uncaught fatal exception (${origin}):\n${sanitized}`);
  if (process.env.NODE_ENV !== "test") {
    process.exit(1);
  }
});

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
    privacyBlurDefault: true,
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
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  let cleanupRef: ((reason?: string) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let progressTimer: NodeJS.Timeout | null = null;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let abortHandler: (() => void) | null = null;

      const cleanup = (reason = "stream_closed") => {
        if (closed) return;
        closed = true;

        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }

        const reqSignal = c.req.raw?.signal;
        if (reqSignal && abortHandler) {
          try {
            reqSignal.removeEventListener("abort", abortHandler);
          } catch {
            // ignore
          }
          abortHandler = null;
        }

        try {
          controller.close();
        } catch {
          // Controller might already be closed or errored; safe to ignore
        }
      };

      cleanupRef = cleanup;

      const encoder = new TextEncoder();

      const sendUpdate = (data: any) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (err: any) {
          cleanup("enqueue_failed");
        }
      };

      const sendComment = (comment: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ${comment}\n\n`));
        } catch {
          cleanup("comment_failed");
        }
      };

      // Handle request abort (client navigation, window close, reload)
      const reqSignal = c.req.raw?.signal;
      if (reqSignal) {
        if (reqSignal.aborted) {
          cleanup("already_aborted");
          return;
        }
        abortHandler = () => {
          cleanup("request_aborted");
        };
        reqSignal.addEventListener("abort", abortHandler, { once: true });
      }

      // Initial state push
      sendUpdate(job);

      if (job.status === "completed" || job.status === "failed") {
        cleanup("job_already_finished");
        return;
      }

      let prevStep = job.step;
      let prevPercent = job.percent;

      // Heartbeat comment every 15 seconds to prevent network/proxy timeout
      heartbeatTimer = setInterval(() => {
        if (closed) {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
          return;
        }
        try {
          sendComment("heartbeat");
        } catch {
          cleanup("heartbeat_failed");
        }
      }, 15000);

      // Poll progress every 300ms
      progressTimer = setInterval(() => {
        if (closed) {
          if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
          }
          return;
        }

        try {
          const currentJob = jobManager.getJob(id);
          if (!currentJob) {
            cleanup("job_removed");
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
            cleanup("job_completed");
          }
        } catch (err: any) {
          console.warn(`[SSE Stream ${id}] Error in progress check:`, err.message || err);
          cleanup("progress_timer_error");
        }
      }, 300);
    },
    cancel(reason) {
      if (cleanupRef) {
        cleanupRef(`stream_cancelled: ${reason || "consumer_cancelled"}`);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
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

    const privacyBlur =
      formData["privacyBlur"] !== "false" && c.req.query("privacyBlur") !== "false";

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
            privacyBlur,
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
        privacyBlur,
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

    const privacyBlur =
      formData["privacyBlur"] !== "false" && c.req.query("privacyBlur") !== "false";

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
            privacyBlur,
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
        privacyBlur,
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

  return c.json({ reports: reports.map(normalizeInspectionReport) });
});

// 9. Single Report Endpoint
app.get("/api/reports/:id", async (c) => {
  const id = c.req.param("id");
  const report = await storage.getById(id);

  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  return c.json(normalizeInspectionReport(report));
});

// 10. Printable Export Endpoint (HTML or JSON)
app.get("/api/reports/:id/export", async (c) => {
  const id = c.req.param("id");
  const report = await storage.getById(id);

  if (!report) {
    return c.text("Report not found", 404);
  }

  const normalized = normalizeInspectionReport(report);
  const format = c.req.query("format");
  if (format === "json") {
    return c.json(normalized);
  }

  const html = generateHtmlReport(normalized);
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
