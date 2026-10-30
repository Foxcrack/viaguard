import { loadEnv } from "./paths.js";
loadEnv();

import sharp from "sharp";
import {
  getMetaClient,
  understandSceneWithMuseSpark,
  segmentConceptWithSAM,
  tokenTracker,
} from "./meta-client.js";

async function generateTestImage(): Promise<{ base64: string; hash: string; width: number; height: number }> {
  const width = 256;
  const height = 256;

  // Create an asphalt-like background with a darker circular "pothole" feature in the center
  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="#374151" />
      <circle cx="128" cy="128" r="48" fill="#111827" stroke="#1f2937" stroke-width="4" />
      <line x1="60" y1="128" x2="80" y2="135" stroke="#111827" stroke-width="3" />
      <line x1="176" y1="128" x2="200" y2="120" stroke="#111827" stroke-width="3" />
    </svg>
  `);

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 55, g: 65, b: 81 },
    },
  })
    .composite([{ input: svgOverlay, blend: "over" }])
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64 = buffer.toString("base64");
  const hash = "test-synthetic-road-patch-256";
  return { base64, hash, width, height };
}

async function runCheck() {
  console.log("==================================================");
  console.log("       Viaguard Meta Model API Health Check       ");
  console.log("==================================================");

  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.error("\n❌ ERROR: MODEL_API_KEY is not set.");
    console.error("Please add your Meta Model API key to your `.env` file at the project root:\n");
    console.error("    MODEL_API_KEY=your_meta_api_key_here\n");
    console.error("Obtain your key from https://dev.meta.ai/");
    console.error("==================================================");
    process.exit(1);
  }

  console.log("✔ MODEL_API_KEY detected in environment (credentials secured).");
  console.log("✔ Connecting to Meta Model API gateway: https://api.meta.ai/v1");

  try {
    const testImage = await generateTestImage();
    console.log(`✔ Generated synthetic road verification image (${testImage.width}x${testImage.height}px)`);

    // 1. Live call to Muse Spark (muse-spark-1.3)
    console.log("\n[1/2] Calling Muse Spark (muse-spark-1.3) for scene understanding...");
    const museStartTime = Date.now();
    const museResult = await understandSceneWithMuseSpark({
      imageBase64: testImage.base64,
      imageHash: testImage.hash,
      moduleType: "road",
      mimeType: "image/jpeg",
    });
    const museDuration = Date.now() - museStartTime;

    console.log(`✔ Muse Spark call successful (${museDuration}ms)!`);
    console.log(`   - Scene Type: "${museResult.scene.scene_type}"`);
    console.log(`   - Condition: "${museResult.scene.overall_condition}"`);
    console.log(`   - Suggested Concepts: [${museResult.scene.visible_damage_types.join(", ")}]`);
    console.log(`   - Cache status: ${museResult.isCached ? "CACHED" : "LIVE"}`);

    // 2. Live call to SAM 3.1 (sam-3.1)
    console.log("\n[2/2] Calling SAM 3.1 (sam-3.1) for concept segmentation...");
    const samStartTime = Date.now();
    const samResult = await segmentConceptWithSAM({
      concept: "pothole",
      imageBase64: testImage.base64,
      imageHash: testImage.hash,
      imageWidth: testImage.width,
      imageHeight: testImage.height,
      mimeType: "image/jpeg",
    });
    const samDuration = Date.now() - samStartTime;

    console.log(`✔ SAM 3.1 streaming segmentation successful (${samDuration}ms)!`);
    console.log(`   - Detections count: ${samResult.findings.length}`);
    for (const f of samResult.findings) {
      console.log(
        `   - Detected [${f.concept}]: confidence=${f.confidence}, relativeArea=${f.relativeAreaPercent}%, activePixels=${f.activePixels}`
      );
    }
    console.log(`   - Cache status: ${samResult.isCached ? "CACHED" : "LIVE"}`);

    console.log("\n==================================================");
    console.log("       RESULT: ALL META API CHECKS PASSED         ");
    console.log(`  Lifetime Tokens Tracked: ${tokenTracker.totalTokens}`);
    console.log("==================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ META MODEL API CHECK FAILED");
    console.error(`Status/Error: ${err.message || err}`);
    if (err.status === 401) {
      console.error("DIAGNOSIS: The provided MODEL_API_KEY was rejected by https://api.meta.ai/v1 (401 Unauthorized). Check your key.");
    } else if (err.status === 404) {
      console.error("DIAGNOSIS: Model identifier not found (404). Ensure muse-spark-1.3 and sam-3.1 are active on your Meta account.");
    } else if (err.status === 429) {
      console.error("DIAGNOSIS: Rate limit exceeded (429). Retry after backoff or check account quota.");
    }
    console.error("==================================================");
    process.exit(1);
  }
}

runCheck();

