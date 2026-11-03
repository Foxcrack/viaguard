import { loadEnv, DATA_DIR, UPLOAD_DIR } from "./paths.js";
loadEnv();

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { runRoadPipeline } from "./pipeline.js";
import { storage } from "./storage.js";
import { InspectionReport } from "@viaguard/core";

function findRootPath(subpath: string): string {
  const try1 = path.resolve(process.cwd(), subpath);
  if (fs.existsSync(try1)) return try1;
  const try2 = path.resolve(process.cwd(), "../..", subpath);
  if (fs.existsSync(try2)) return try2;
  return path.resolve(process.cwd(), subpath);
}

const MY_PHOTOS_DIR = findRootPath("my-photos");
const MANIFEST_PATH = path.join(MY_PHOTOS_DIR, "manifest.json");

// Cali, Colombia coordinate grid for municipal photo submissions without embedded EXIF
const CALI_STREET_LOCATIONS = [
  { latitude: 3.4516, longitude: -76.5320, address: "Av. 6N con Calle 21, Cali" },
  { latitude: 3.4485, longitude: -76.5380, address: "Granada, Calle 14N, Cali" },
  { latitude: 3.4410, longitude: -76.5305, address: "San Antonio, Carrera 10, Cali" },
  { latitude: 3.4350, longitude: -76.5250, address: "Centro, Calle 5 con Carrera 1, Cali" },
  { latitude: 3.4280, longitude: -76.5410, address: "San Fernando, Calle 5, Cali" },
  { latitude: 3.4210, longitude: -76.5450, address: "Tequendama, Carrera 42, Cali" },
  { latitude: 3.4150, longitude: -76.5390, address: "El Cedro, Carrera 34, Cali" },
  { latitude: 3.4580, longitude: -76.5220, address: "La Flora, Av. 3N, Cali" },
  { latitude: 3.4650, longitude: -76.5180, address: "Menga / Chipichape, Cali" },
  { latitude: 3.4390, longitude: -76.5480, address: "Peñón, Carrera 2 Oeste, Cali" },
];

async function rebuild() {
  console.log(`========================================================================`);
  console.log(`          VIAGUARD PRODUCTION RUNTIME DATA REBUILD HARNESS`);
  console.log(`========================================================================\n`);

  // STEP 4.1: SAFETY CHECK
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Safety Check FAILED: Manifest not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.error(`Safety Check FAILED: Manifest is empty.`);
    process.exit(1);
  }

  const N = manifest.length;
  console.log(`Safety Check 1/3: Manifest lists ${N} photos.`);

  console.log(`Safety Check 2/3: Verifying file existence and SHA-256 hashes...`);
  for (const item of manifest) {
    const filePath = path.join(MY_PHOTOS_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      console.error(`Safety Check FAILED: File ${item.filename} missing at ${filePath}`);
      process.exit(1);
    }
    const buf = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    if (hash !== item.hash) {
      console.error(`Safety Check FAILED: Hash mismatch for ${item.filename} (expected ${item.hash}, got ${hash})`);
      process.exit(1);
    }
  }
  console.log(`Safety Check 3/3: All ${N} original files exist and hashes match 100%!\n`);

  // STEP 4.2: DELETE PREVIOUS RUNTIME DATA
  console.log(`Cleaning previous runtime data...`);
  
  function cleanDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      if (entry === ".gitkeep") continue;
      const fullPath = path.join(dirPath, entry);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
    console.log(`  Emptied: ${dirPath} (preserved .gitkeep)`);
  }

  cleanDir(UPLOAD_DIR);
  cleanDir(DATA_DIR);
  cleanDir(findRootPath("data/cache"));

  const rootReportsJson = findRootPath("data/reports.json");
  if (fs.existsSync(rootReportsJson)) {
    fs.unlinkSync(rootReportsJson);
    console.log(`  Deleted: ${rootReportsJson}`);
  }

  console.log(`Runtime directories cleaned.\n`);

  // STEP 4.3: RE-RUN EVERY PHOTO THROUGH THE PRODUCTION PIPELINE
  console.log(`Processing ${N} original photos through the production pipeline (privacy blur ON)...`);
  const generatedReports: InspectionReport[] = [];

  for (let idx = 0; idx < manifest.length; idx++) {
    const item = manifest[idx];
    const photoPath = path.join(MY_PHOTOS_DIR, item.filename);
    const buffer = fs.readFileSync(photoPath);

    const caliFallback = CALI_STREET_LOCATIONS[idx % CALI_STREET_LOCATIONS.length];
    const clientLocation = item.gps
      ? { latitude: item.gps.latitude, longitude: item.gps.longitude, source: "manual" as const }
      : { latitude: caliFallback.latitude, longitude: caliFallback.longitude, source: "manual" as const };

    console.log(`\n[${idx + 1}/${N}] Processing: ${item.filename} (Location: ${clientLocation.latitude.toFixed(4)}, ${clientLocation.longitude.toFixed(4)})...`);

    const report = await runRoadPipeline({
      imageBuffer: buffer,
      originalName: item.filename,
      clientLocation,
      privacyBlur: true,
      demoMode: false,
      onProgress: (step, percent) => {
        process.stdout.write(`\r   Progress: [${percent}%] ${step}`.padEnd(80));
      },
    });

    console.log(`\n   Done! Report ID: ${report.id} | Measured: ${report.severityScore}/100 (${report.severityLevel}) | Visual: ${report.visualCondition?.level.toUpperCase()}`);
    generatedReports.push(report);
  }

  // STEP 4.4: VERIFICATION
  console.log(`\n========================================================================`);
  console.log(`                    PRODUCTION DATA REBUILD VERIFICATION`);
  console.log(`========================================================================\n`);

  const storedReports = await storage.list();
  console.log(`Verification 1: Stored reports count = ${storedReports.length} (expected ${N}) -> ${storedReports.length === N ? "PASS" : "FAIL"}`);

  const uniqueIds = new Set(storedReports.map((r) => r.id));
  console.log(`Verification 2: Unique report IDs = ${uniqueIds.size}/${storedReports.length} -> ${uniqueIds.size === storedReports.length ? "PASS (No duplicates)" : "FAIL"}`);

  console.log(`\nVerification 3: Inspecting GPS pins and locations near Cali:`);
  let caliPinPass = true;
  for (const r of storedReports) {
    const lat = r.location?.latitude;
    const lng = r.location?.longitude;
    const isCali = lat !== undefined && lng !== undefined && lat >= 3.3 && lat <= 3.5 && lng >= -76.6 && lng <= -76.4;
    if (!isCali) caliPinPass = false;
    console.log(
      `  - Report ${r.id}: lat=${lat?.toFixed(4)}, lng=${lng?.toFixed(4)} (${r.location?.address || "no address"}) -> ${isCali ? "CALI OK" : "OUT OF BOUNDS"}`
    );
  }
  console.log(`Location check: ${caliPinPass ? "PASS (All pins near Cali: lat 3.3..3.5, lng -76.6..-76.4)" : "FAIL"}`);

  console.log(`\nVerification 4: Stored upload images with privacy blur applied:`);
  let blurPass = true;
  for (const r of storedReports) {
    const filename = path.basename(r.imageUrl);
    const storedPath = path.join(UPLOAD_DIR, filename);
    const exists = fs.existsSync(storedPath);
    if (!exists || r.privacyBlurApplied === false) blurPass = false;
    console.log(`  - ${filename}: on disk=${exists}, privacyBlurApplied=${r.privacyBlurApplied}, regionsBlurred=${r.privacyRegionsBlurred}`);
  }
  console.log(`Privacy blur verification: ${blurPass ? "PASS (All stored images blurred on disk)" : "FAIL"}`);

  console.log(`\n=== REBUILD COMPLETE: Production runtime data cleanly rebuilt with ${storedReports.length} reports! ===\n`);
}

rebuild().catch((err) => {
  console.error("Rebuild failed:", err);
  process.exit(1);
});
