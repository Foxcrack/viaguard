#!/usr/bin/env tsx
/**
 * pnpm record:demo <image-path>
 *
 * Runs the full live pipeline on a real image and saves the API responses
 * to data/cache/ so they can be replayed in demo mode with the visible
 * "Replaying cached real responses" banner.
 *
 * Requires MODEL_API_KEY to be set in .env
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Usage: pnpm record:demo <image-path>");
    process.exit(1);
  }
  if (!process.env.MODEL_API_KEY) {
    console.error("BLOCKED: MODEL_API_KEY not set. Cannot record real API responses.");
    console.error("Set MODEL_API_KEY in .env and re-run.");
    process.exit(1);
  }
  const absPath = path.resolve(imagePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Image not found: ${absPath}`);
    process.exit(1);
  }

  const { runRoadPipeline } = await import("./pipeline.js");
  const imageBuffer = fs.readFileSync(absPath);
  const originalName = path.basename(absPath);

  console.log(`Running live pipeline on: ${originalName}`);
  console.log("(This makes real API calls to Meta Model API)");

  const report = await runRoadPipeline({
    imageBuffer,
    originalName,
    onProgress: (msg, pct) => {
      process.stdout.write(`  [${pct}%] ${msg}\n`);
    },
  });

  const cacheDir = path.resolve(process.cwd(), "../../data/cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, `${path.parse(originalName).name}.json`);
  fs.writeFileSync(cacheFile, JSON.stringify(report, null, 2));

  console.log(`\n✅ Real response cached at: ${cacheFile}`);
  console.log(`   Report ID: ${report.id}`);
  console.log(`   Severity: ${report.severityLevel} (score: ${report.severityScore})`);
  console.log(`   Findings: ${report.findings.length}`);
  console.log("\nThis cached response will be used when DEMO_MODE=true.");
}

main().catch((err) => {
  console.error("Pipeline failed:", err.message);
  process.exit(1);
});
