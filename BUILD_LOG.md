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
