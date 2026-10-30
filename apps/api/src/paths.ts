import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(CURRENT_DIR, "..", "..", "..");
export const DATA_DIR = path.join(REPO_ROOT, "data");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const UPLOAD_DIR = path.join(REPO_ROOT, "apps", "api", "uploads");
export const SAMPLES_DIR = path.join(REPO_ROOT, "apps", "web", "public", "samples");

let envLoaded = false;

/**
 * Loads environment variables from the monorepo root .env (and local .env if present)
 * without printing or logging any values.
 */
export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  const rootEnvPath = path.join(REPO_ROOT, ".env");
  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  }
  dotenv.config();
}

/**
 * Resolves a CLI file argument relative to either process.cwd() or REPO_ROOT.
 */
export function resolveInputPath(inputArg: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), inputArg),
    path.resolve(REPO_ROOT, inputArg),
    inputArg,
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}
