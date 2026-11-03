import { loadEnv } from "./paths.js";
loadEnv();

import * as fs from "fs";
import * as path from "path";
import { runRoadPipeline, runConstructionPipeline } from "./pipeline.js";

async function resolveImageFile(imageArg?: string): Promise<{ buffer: Buffer; name: string } | null> {
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
    return null;
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

  return null;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const imageArg = args[0];
  const afterArg = args[1];
  console.log("==================================================");
  console.log("      Viaguard Pipeline CLI Sample Runner        ");
  console.log("==================================================");

  try {
    if (imageArg && afterArg) {
      const beforeInput = await resolveImageFile(imageArg);
      const afterInput = await resolveImageFile(afterArg);
      if (!beforeInput) {
        console.error(`Error: Before-image not found: "${imageArg}"`);
        process.exit(1);
      }
      if (!afterInput) {
        console.error(`Error: After-image not found: "${afterArg}"`);
        process.exit(1);
      }
      console.log(
        `Processing construction pair: ${beforeInput.name} (${beforeInput.buffer.length} B) -> ${afterInput.name} (${afterInput.buffer.length} B)...`
      );
      const report = await runConstructionPipeline({
        beforeBuffer: beforeInput.buffer,
        afterBuffer: afterInput.buffer,
        beforeName: beforeInput.name,
        afterName: afterInput.name,
        onProgress: (step, percent) => {
          console.log(`  [${percent.toString().padStart(3)}%] ${step}`);
        },
      });

      console.log("\n==================================================");
      console.log("      CONSTRUCTION DIFF REPORT GENERATED          ");
      console.log("==================================================");
      console.log(`Report ID:                     ${report.id}`);
      console.log(`Timestamp:                     ${report.createdAt}`);
      console.log(`Title:                         ${report.title}`);
      console.log(
        `Progress Index:                ${
          (report.constructionDiff?.progressScore ?? 0) >= 0 ? "+" : ""
        }${report.constructionDiff?.progressScore ?? 0}`
      );
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
      console.log(
        `Privacy Blur:                  ${report.privacyBlurApplied ? "on" : "off"} (${report.privacyRegionsBlurred} regions blurred)`
      );
      console.log(`Cached:                        ${report.isCached ? "YES" : "NO"}`);
      console.log(
        `Before Findings:               ${report.findings.length} | After Findings: ${report.afterFindings?.length ?? 0}`
      );
      if (report.constructionDiff) {
        console.log(`Overall Diff Assessment:       ${report.constructionDiff.overallAssessment}`);
        for (const c of report.constructionDiff.conceptChanges) {
          console.log(
            `  - ${c.concept.padEnd(18)}: count ${c.beforeCount} -> ${c.afterCount} (${
              c.deltaCount >= 0 ? "+" : ""
            }${c.deltaCount}) | area ${c.beforeAreaPercent}% -> ${c.afterAreaPercent}% (${
              c.deltaAreaPercent >= 0 ? "+" : ""
            }${c.deltaAreaPercent}%) [${c.status.toUpperCase()}]`
          );
        }
      }
      if (report.limitations) {
        console.log(`  ${report.limitations}`);
      }
      console.log("Summary:");
      console.log(`  "${report.summary}"`);
      console.log("==================================================");
      process.exit(0);
    }

    const resolved = await resolveImageFile(imageArg);
    if (!resolved) {
      if (imageArg) {
        console.error(`Error: Image file not found: "${imageArg}"`);
      } else {
        console.log("Usage:");
        console.log("  Road Damage:           pnpm analyze:sample <image-path>");
        console.log("  Construction Progress: pnpm analyze:sample <before-image-path> <after-image-path>");
        console.log("\nExamples:");
        console.log("  pnpm analyze:sample ./my-photos/street-1.jpg");
        console.log("  pnpm analyze:sample ./my-photos/site-before.jpg ./my-photos/site-after.jpg");
        console.log("\nOr place your own images in apps/web/public/samples/ to analyze them by default.");
      }
      process.exit(1);
    }

    const { buffer, name } = resolved;
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
