import { loadEnv } from "./paths.js";
loadEnv();

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { runRoadPipeline } from "./pipeline.js";

async function getOrGenerateSampleBuffer(imageArg?: string): Promise<{ buffer: Buffer; name: string }> {
  if (imageArg) {
    const candidates = [
      imageArg,
      path.resolve(imageArg),
      path.resolve(process.cwd(), imageArg),
      path.resolve(process.cwd(), "..", "..", imageArg),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return { buffer: fs.readFileSync(cand), name: path.basename(cand) };
      }
    }
  }

  // Look in apps/web/public/samples
  const samplesDir = path.resolve(process.cwd(), "..", "web", "public", "samples");
  if (fs.existsSync(samplesDir)) {
    const files = fs
      .readdirSync(samplesDir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    const roadFile = files.find((f) => f.includes("pothole") || f.includes("road"));
    if (roadFile) {
      const samplePath = path.join(samplesDir, roadFile);
      return { buffer: fs.readFileSync(samplePath), name: roadFile };
    }
    if (files.length > 0) {
      const samplePath = path.join(samplesDir, files[0]);
      return { buffer: fs.readFileSync(samplePath), name: files[0] };
    }
  }

  // Generate synthetic sample road image with pothole defect
  console.log("No external sample provided. Generating synthetic road damage image (800x600)...");
  const svg = Buffer.from(`
    <svg width="800" height="600">
      <rect width="800" height="600" fill="#374151" />
      <ellipse cx="400" cy="350" rx="140" ry="70" fill="#111827" stroke="#1f2937" stroke-width="8" />
      <path d="M 220 340 L 250 355 L 290 345" stroke="#111827" stroke-width="4" fill="none" />
      <path d="M 520 360 L 570 375 L 610 370" stroke="#111827" stroke-width="4" fill="none" />
      <circle cx="680" cy="180" r="45" fill="#4b5563" stroke="#1f2937" stroke-width="6" />
    </svg>
  `);

  const buf = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 55, g: 65, b: 81 },
    },
  })
    .composite([{ input: svg, blend: "over" }])
    .jpeg({ quality: 85 })
    .toBuffer();

  return { buffer: buf, name: "synthetic-road-pothole.jpg" };
}

async function main() {
  const imageArg = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  console.log("==================================================");
  console.log("      Viaguard Pipeline CLI Sample Runner        ");
  console.log("==================================================");

  try {
    const { buffer, name } = await getOrGenerateSampleBuffer(imageArg);
    console.log(`Processing inspection photo: ${name} (${buffer.length} bytes)...`);

    const report = await runRoadPipeline({
      imageBuffer: buffer,
      originalName: name,
      onProgress: (step, percent) => {
        console.log(`  [${percent.toString().padStart(3)}%] ${step}`);
      },
    });

    console.log("\n==================================================");
    console.log("           INSPECTION REPORT GENERATED            ");
    console.log("==================================================");
    console.log(`Report ID:                     ${report.id}`);
    console.log(`Timestamp:                     ${report.createdAt}`);
    console.log(`Title:                         ${report.title}`);
    console.log(
      `Measured severity (SAM):       ${report.measuredSeverity?.score ?? report.severityScore}/100 [${(
        report.measuredSeverity?.level ?? report.severityLevel
      ).toUpperCase()}]`
    );
    console.log(
      `Visual condition (Muse Spark): ${(
        report.visualCondition?.level ?? report.overallCondition
      ).toUpperCase()} — ${report.visualCondition?.explanation ?? ""}`
    );
    if (report.signalDiscrepancyNote) {
      console.log(`Signal Discrepancy Note:       ${report.signalDiscrepancyNote}`);
    }
    console.log(`Scene Type:                    ${report.sceneType}`);
    console.log(`Urgency (deterministic):       ${report.estimatedUrgency}`);
    console.log(`Action Required:               ${report.recommendedAction}`);
    console.log(`Stored Image:                  ${report.imageUrl}`);
    console.log(
      `Privacy Blur:                  ${report.privacyBlurApplied ? "on" : "off"} (${report.privacyRegionsBlurred} regions blurred)`
    );
    console.log(`Cached:                        ${report.isCached ? "YES" : "NO"}`);
    if (report.severityBreakdown) {
      const b = report.severityBreakdown;
      const weightsStr =
        Object.entries(b.appliedTypeWeights)
          .map(([k, v]) => `${k}=${v}x`)
          .join(", ") || "none";
      console.log("Severity Breakdown:");
      console.log(
        `  - Total Area Score:   ${b.totalAreaScore} / 50 pts (raw=${b.rawTotalAreaPercent}%, weighted=${b.weightedTotalArea}%)`
      );
      console.log(
        `  - Largest Defect:     ${b.largestInstanceScore} / 40 pts (raw=${b.largestInstanceRawAreaPercent}%, weighted=${b.largestInstanceWeightedArea}%)`
      );
      console.log(
        `  - Count Bonus:        +${b.countBonus} / 10 pts (${b.damageInstanceCount} instance(s))`
      );
      console.log(`  - Avg Confidence:     ${(b.averageConfidence * 100).toFixed(0)}% (${b.averageConfidence})`);
      console.log(`  - Type Weights:       ${weightsStr}`);
      console.log(`  - Raw -> Final Score: ${b.rawScore} -> ${b.finalScore}/100`);
    }
    console.log(`Total Findings:                ${report.findings.length}`);
    report.findings.forEach((f, idx) => {
      console.log(
        `  #${idx + 1} ${f.concept.padEnd(20)}: relativeArea=${f.relativeAreaPercent}% | confidence=${f.confidence} | bbox=[${f.boundingBox.x1}, ${f.boundingBox.y1}, ${f.boundingBox.x2}, ${f.boundingBox.y2}]`
      );
    });
    if (report.limitations) {
      console.log(`  ${report.limitations}`);
    }
    console.log("Summary:");
    console.log(`  "${report.summary}"`);
    console.log("==================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ Pipeline execution encountered an error:");
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
