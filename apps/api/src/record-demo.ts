#!/usr/bin/env tsx
/**
 * pnpm record:demo <image-path> [<after-image-path>]
 *
 * Runs the LIVE Meta Model API pipeline (Muse Spark + SAM 3.1) on real image(s)
 * and records the verified responses into data/cache/ for opt-in Demo Mode replay.
 *
 * Requires MODEL_API_KEY to be set in .env at the project root.
 */
import * as fs from "fs";
import * as path from "path";
import { CACHE_DIR, loadEnv, resolveInputPath } from "./paths.js";

loadEnv();

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (args.length === 0) {
    console.error("Usage:");
    console.error("  Road image:         pnpm record:demo <image-path>");
    console.error("  Construction pair:  pnpm record:demo <before-image-path> <after-image-path>");
    process.exit(1);
  }

  if (!process.env.MODEL_API_KEY || process.env.MODEL_API_KEY.trim() === "") {
    console.error("BLOCKED: missing MODEL_API_KEY");
    console.error("Set MODEL_API_KEY in .env at the project root and re-run to record real API responses.");
    process.exit(1);
  }

  const firstPath = resolveInputPath(args[0]);
  if (!firstPath) {
    console.error(`Image not found: ${args[0]}`);
    process.exit(1);
  }

  const { runRoadPipeline, runConstructionPipeline } = await import("./pipeline.js");

  if (args.length >= 2) {
    const secondPath = resolveInputPath(args[1]);
    if (!secondPath) {
      console.error(`After image not found: ${args[1]}`);
      process.exit(1);
    }

    const beforeBuffer = fs.readFileSync(firstPath);
    const afterBuffer = fs.readFileSync(secondPath);
    const beforeName = path.basename(firstPath);
    const afterName = path.basename(secondPath);

    console.log(`Recording LIVE comparative construction pipeline for: ${beforeName} -> ${afterName}`);
    const report = await runConstructionPipeline({
      beforeBuffer,
      afterBuffer,
      beforeName,
      afterName,
      demoMode: false,
      recordDemo: true,
      onProgress: (msg, pct) => {
        process.stdout.write(`  [${String(pct).padStart(3)}%] ${msg}\n`);
      },
    });

    console.log(`\nRecorded real Meta Model API responses in: ${CACHE_DIR}`);
    console.log(`  Report ID:      ${report.id}`);
    console.log(`  Progress Score: ${report.constructionDiff?.progressScore ?? 0}`);
    console.log(`  Models Used:    ${report.modelsUsed?.vision} + ${report.modelsUsed?.segmentation}`);
    return;
  }

  const imageBuffer = fs.readFileSync(firstPath);
  const originalName = path.basename(firstPath);

  console.log(`Recording LIVE road damage pipeline for: ${originalName}`);
  const report = await runRoadPipeline({
    imageBuffer,
    originalName,
    demoMode: false,
    recordDemo: true,
    onProgress: (msg, pct) => {
      process.stdout.write(`  [${String(pct).padStart(3)}%] ${msg}\n`);
    },
  });

  console.log(`\nRecorded real Meta Model API responses in: ${CACHE_DIR}`);
  console.log(`  Report ID:   ${report.id}`);
  console.log(`  Severity:    ${report.severityLevel.toUpperCase()} (${report.severityScore}/100)`);
  console.log(`  Findings:    ${report.findings.length}`);
  console.log(`  Models Used: ${report.modelsUsed?.vision} + ${report.modelsUsed?.segmentation}`);
}

main().catch((err) => {
  console.error("Failed recording live demo response:", err.message || err);
  process.exit(1);
});
