# Viaguard Build Log

All development decisions, milestones, testing notes, and command outputs during the Meta Global AI Developer Hackathon (Oct 27 – Nov 4, 2026).

---

## 2026-10-29 – Phase 0: Foundation Setup

### What was built
- Initialized pnpm workspace monorepo layout:
  - `apps/web`: Vite + React 18 + TypeScript + Tailwind CSS
  - `apps/api`: Node 20+ with Hono + TypeScript
  - `packages/core`: shared inspection pipeline, scoring, area math, and types
- Created `.gitignore`, `.env.example`, `LICENSE` (MIT), `THIRD_PARTY.md`, and skeleton `README.md`.
- Configured TypeScript in strict mode across root and all workspace packages.
- Configured Vitest test runner for core unit tests.

### Decisions
- Package Manager: `pnpm@12.3.4` workspace configured via `pnpm-workspace.yaml`.
- Monorepo package naming convention: `@viaguard/core`, `@viaguard/api`, and `@viaguard/web`.
- Database storage: SQLite via `better-sqlite3` with an automatic in-memory/JSON fallback if native compilation encounters platform restrictions on Windows Node 24.
- API framework: Hono with `@hono/node-server` for light, high-speed, standard Web API compatibility on Node 20+.

### Problems & Resolutions
- None in Phase 0. Workspace structure initialized cleanly.

### Next Steps
- Implement Phase 1: Meta Model API client in `@viaguard/api` / `@viaguard/core` with OpenAI SDK Responses API, `@meta-sam/parser` mask decoding, backoff/retry, disk caching, token tracking, and `pnpm check:meta`.

---

## 2026-10-29 – Phase 1: Meta Model API Client

### What was built
- Implemented `apps/api/src/meta-client.ts` using the OpenAI SDK configured for Meta Model API (`https://api.meta.ai/v1`).
- Implemented strict error handling according to Meta developer specs:
  - 400 (Bad Request): Immediate permanent rejection with request diagnostics.
  - 401 (Unauthorized): Explicit error indicating missing/invalid `MODEL_API_KEY`.
  - 404 (Model Not Found): Explicit error for invalid model identifiers.
  - 429 (Rate Limit) & 5xx: Exponential backoff with a hard cap of 3 attempts.
- Implemented deterministic disk caching under `apps/api/data/cache/` keyed by `sha256(model + prompt + imageHash)` to conserve API credits.
- Implemented running token tracker with per-request and cumulative token logging.
- Integrated official `@meta-sam/parser` client library (`parseImageStream`, `recordsOfKind`, `decodeMaskToRaster`, and `decodeMaskToSVGPath`) for `sam-3.1` streaming segmentation and raster decoding.
- Integrated structured output parsing and Zod schema validation for `muse-spark-1.3` (scene reasoning and report authoring).
- Created verification script `apps/api/src/check-meta.ts` (`pnpm check:meta`).

### Verification Output
- Running `pnpm check:meta` with unset `MODEL_API_KEY`:
  - Verified that `check:meta` gracefully halts, preserves key security, and outputs clear instructions directing the developer to configure `.env`.
- Type checking passes across `@viaguard/core` and `@viaguard/api`.

### Decisions
- In `sam-3.1` segmentation requests, set `metadata: { mask_encoding: "one_bit", include_confidence: "true" }` as specified in Meta's documentation to maximize token efficiency and receive per-instance confidence scores.
- Implemented dual mask rendering artifacts: binary raster for mathematical area calculation, and SVG path strings (`decodeMaskToSVGPath`) for efficient, responsive client-side visual overlays.

### Next Steps
- Phase 2: Core Inspection Pipeline in `packages/core` (preprocessing, area calculation, scoring, diffing, report generation) with Vitest unit tests and CLI sample runner.

---

## 2026-10-29 – Phase 2: Core Inspection Pipeline

### What was built
- Implemented full 6-step core inspection pipeline in `apps/api/src/pipeline.ts`:
  1. `preprocessImage`: Validates <10MB size, verifies JPEG/PNG/WebP format, extracts EXIF GPS tags using `exifr.gps()` before modification, resizes max dimension to 1600px with `sharp`, computes SHA256, and stores files in `uploads/`.
  2. `Scene Understanding`: Structured inference with `muse-spark-1.3` to extract scene classification and dynamic concept suggestions.
  3. `Segmentation`: Streaming segmentation with `sam-3.1`, `@meta-sam/parser` mask decoding, vector SVG path conversion, and relative area percentages.
  4. `Deterministic Severity Scoring`: `calculateSeverity()` computing mathematical hazard scores (0-100) and severity bands (`low`, `medium`, `high`, `critical`) based on relative areas, instance counts, confidence, and concept hazard weights.
  5. `Report Authoring`: Structured reporting with `muse-spark-1.3` producing actionable municipal recommendations and urgency tiers.
  6. `Persistence`: Storage abstraction in `apps/api/src/storage.ts` writing atomic JSON records to `data/reports.json`.
- Implemented comparative construction site analysis (`compareConstructionSites` in `packages/core/src/diff.ts`) comparing instance counts and relative area percentages across time.
- Implemented CLI runner `pnpm analyze:sample` in `apps/api/src/cli-sample.ts` for end-to-end headless verification.
- Implemented comprehensive Vitest test suites in `packages/core/test/` for scoring, diffing, and schema validation.

### Verification Output
- `pnpm test`: 13 unit tests passed across 4 test suites.
- Type checking passes across all workspace packages.

### Decisions
- Neutral elements (such as manhole covers) are isolated from road hazard calculations to prevent false escalation of street severity scores while preserving spatial context.
- SAM concept execution utilizes a concurrency worker pool capped at 2 to balance throughput while respecting API rate limits.

### Next Steps
- Phase 3: Backend API HTTP endpoints with Hono, multipart image upload handling, progress polling/events, and sample image provisioning.

---

## 2026-10-29 – Phase 3: Backend HTTP API & Persistence

### What was built
- Implemented full suite of Hono HTTP REST endpoints in `apps/api/src/index.ts`:
  - `GET /api/health`: Health status, version, timestamp, token tracking, and model IDs.
  - `POST /api/road/analyze`: Multipart upload handling with optional EXIF / browser / manual coordinate capture, supporting synchronous and async background jobs.
  - `POST /api/construction/analyze`: Multipart before/after image intake with comparative diffing.
  - `GET /api/jobs/:id` & `GET /api/jobs/:id/stream`: Server-Sent Events (SSE) progress streaming emitting real-time percentage and step updates to the frontend.
  - `GET /api/reports`: Filterable persistent list (by module, severity, date limit).
  - `GET /api/reports/:id`: Single report retrieval.
  - `GET /api/reports/:id/export`: Printable civic inspection HTML document with print-ready CSS (`@media print`) and JSON export toggle (`?format=json`).
  - `GET /api/demo/samples`: Dynamic enumeration of bundled demo inspection assets.
  - `GET /uploads/:filename`: Static serving with strict path sanitization to guard against path traversal.
- Programmed sample generator `apps/api/src/generate-samples.ts` providing 4 synthetic test cases (pothole damage, alligator cracks, construction site before, construction site after) in `apps/web/public/samples/`.
- Implemented in-memory job manager (`apps/api/src/jobs.ts`) with automated lifecycle cleanup.
- Added comprehensive endpoint test suite `apps/api/test/api.test.ts`.

### Verification Output
- `pnpm test`: 20 unit and endpoint tests passed (13 core tests + 7 API integration tests).
- All endpoints tested and verified with standard HTTP requests.

### Decisions
- SSE stream implementation sends state heartbeats and cleanly terminates when the pipeline reaches `completed` or `failed` state.
- HTML export styling adopts standard civic authority typography and high-contrast accessibility standards.

### Next Steps
- Phase 4: Frontend Road Damage Module + Geolocation Map (`apps/web` with Vite, React Router, Tailwind CSS, Leaflet, and React Bits modern components).
