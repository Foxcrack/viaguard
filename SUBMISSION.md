# Viaguard – Hackathon Submission

**Meta Global AI Developer Hackathon 2026**  
**Track:** Indie Developer  
**Theme:** Build for Your World  
**Repository:** https://github.com/Foxcrack/viaguard  
**Demo Video (2:15 min):** https://www.youtube.com/watch?v=pgNsmuAlP-E  
**License:** MIT  

---

## 1. Project Description (Official Portal Short Description)

Viaguard turns phone photos of streets into geolocated, severity-scored inspection reports for city teams. Muse Spark understands the scene, SAM 3.1 segments the defects, and deterministic code computes severity and urgency. Privacy blur on pedestrians and license plates is on by default. Tested on 10 photos taken in Cali, Colombia: SAM detected at least one defect in 7 and none in 3; results are conservative and diffuse wear can be missed. A secondary construction before/after module is included but not validated on real field photos.

---

## 2. What Was Built During the Hackathon

Everything in the repository, from the first commit on Oct 29, 2026. Built solo with an AI coding agent that I directed and tested.

- **Monorepo Architecture**: Clean `pnpm` workspace dividing `@viaguard/core`, `@viaguard/api`, and `@viaguard/web`.
- **Meta Model API Client**: Native OpenAI SDK Responses API integration with Meta's endpoint (`https://api.meta.ai/v1`), strict `json_schema` structured output (`text.format`), token usage tracking, and exponential backoff retry.
- **Official SAM Parser & Post-Processing**: Deep integration of `@meta-sam/parser` (`parseImageStream`, `decodeMaskToRaster`, and `decodeMaskToSVGPath`) paired with plain-noun concept sanitizing, per-concept confidence thresholds (`pothole`: 0.5, `crack`: 0.5, default: 0.6), minimum mask area filtering (`MIN_AREA_RATIO = 0.05%`), hazard-aware preservation, and cross-concept pixel-mask Non-Maximum Suppression (`IoU > 0.5`).
- **Separated Signals & Deterministic Severity Engine**: Area- and largest-defect-dominant formula (`packages/core/src/scoring.ts`) exposing full score breakdowns, paired with neutral report titles, deterministic repair urgency mapping (`within 30 days` / `within 14 days` / `within 7 days` / `immediate`), honest zero-finding report text enforcement, and explicit separation between **`Measured severity (SAM)`** and **`Visual condition (Muse Spark)`**.
- **Geospatial Mapping**: OpenStreetMap / Leaflet integration with severity-coded pins, auto-populated camera EXIF GPS coordinates, bounded views, and responsive auto-fitting.
- **Comparative Construction Diffing**: Quantitative element delta tracker comparing BEFORE and AFTER site photos with an interactive draggable `BeforeAfterSlider` and `Progress Index`.
- **Default-On Civic Privacy Protection**: Automated SAM 3.1 segmentation (`"person"`, `"license plate"`) and 2-stage pixel mosaic + Gaussian blurring enabled ON by default (`Privacy blur: on`) directly on stored uploads.
- **Testing**: 58 automated Vitest unit and integration tests (`39` in `@viaguard/core` + `19` in `@viaguard/api`) covering filtering, NMS, scoring breakdowns, signal separation, honest report texts, urgency mapping, construction diffing, Zod schemas, safe SSE streaming, API routes, opt-in Demo Mode honesty, and privacy blur.

---

## 3. How Meta's Models Are Used

SAM 3.1 (Meta Model API) segments potholes, cracks, pedestrians and license plates with streaming mask output. Muse Spark 1.3 does structured scene understanding and writes the repair recommendation from measured data only.

### `sam-3.1` (Segmentation Model)
- Invoked via the Responses API with `stream: true`.
- Evaluates sanitized 1-to-2-word plain-noun concept prompts (e.g., `"pothole"`, `"crack"`, `"concrete wall"`, `"scaffolding"`, plus `"person"` and `"license plate"` for privacy protection).
- Employs 1-bit mask encoding (`metadata: { mask_encoding: "one_bit", include_confidence: "true" }`) for compact streaming payloads.
- Stream chunks are parsed with `@meta-sam/parser`, decoded into row-major binary rasters for relative frame area percentages and pixel-mask NMS deduplication, and converted to vector SVG paths for interactive client overlays.

### `muse-spark-1.3` (Reasoning & Vision Model)
- **Scene Understanding**: Inspects uploaded images via strict Responses API `json_schema` output to classify scene type, assess `overall_condition` (`good` / `fair` / `poor` / `critical`), and suggest plain-noun target concepts for SAM 3.1.
- **Construction Diff Reasoning**: Interprets BEFORE and AFTER element count and area deltas alongside the `AFTER` site image to distinguish structural progression from debris or crack accumulation.
- **Municipal Report Authoring**: Receives the filtered SAM measurements and the code-determined urgency timeframe as fixed inputs, authoring concise repair directives and a single-sentence visual condition explanation without inventing defect counts or titles.

---

## 4. Three-Minute Demo Video Script

**Target Video Length:** 3:00 (180 seconds)

### [0:00 – 0:20] The Problem: Slow & Subjective Street Inspections
- **Visual:** Open on a real smartphone photo of a damaged street with a deep pothole, pedestrians, and parked cars, then cut to the Viaguard home dashboard.
- **Voiceover:** *"Every day, city public works teams receive street photos from inspectors and citizens—but turning raw photos into measured, prioritized work orders is slow and inconsistent. Viaguard turns any phone photo of a street or job site into a transparent inspection report powered by Meta Muse Spark and SAM 3.1."*

### [0:20 – 1:15] Live Road Damage Pipeline & Default-On Privacy Blur
- **Visual:** Open **Road Damage**, upload a real street photo (showing EXIF GPS coordinates if present, or setting location pin). Keep `Privacy blur` enabled (default ON) and click **Run Road Inspection** in **Live API** mode. Show the 4-stage live progress stepper (`Preprocess & EXIF` → `Muse Spark Scene` → `SAM 3.1 Masks` → `Municipal Report`).
- **Voiceover:** *"In Live API mode, Viaguard reads EXIF GPS coordinates, then sends the frame to Meta’s Muse Spark for structured scene understanding and plain-noun concept selection. Next, SAM 3.1 streams 1-bit segmentation masks decoded with `@meta-sam/parser`. Notice that pedestrians and vehicle license plates are automatically blurred on the stored photo (`Privacy blur: on`) before the report is saved."*

### [1:15 – 2:05] Decluttered Masks, Separated Signals & Printable Work Order
- **Visual:** Show the inspected street photo with clean numbered badges (`1, 2...`) matching the `Detected Findings` list on the right. Hover over `#1 pothole` to reveal its callout (`area% · conf%`) and toggle `Boxes`. Scroll to the two separated signal cards—**`Measured severity (SAM)`** (with its full `Severity Score Breakdown`: total area, largest defect, capped count bonus) beside **`Visual condition (Muse Spark)`** (showing the discrepancy note when diffuse wear differs from discrete defects) and the neutral report header (`Road inspection report — YYYY-MM-DD`) with deterministic urgency (`within 7 days` / `within 30 days`). Briefly show the pin on **Civic Map** and click **Print / Export PDF** to display the clean printable work order.
- **Voiceover:** *"Post-processing filters out tiny noise and deduplicates overlapping masks via pixel-level NMS. Viaguard never mixes signals: SAM’s deterministic area-based severity score and full mathematical breakdown sit side-by-side with Muse Spark’s visual condition assessment, a neutral report title, and a fixed policy repair window. Every geolocated inspection appears on the Civic Map and exports cleanly as a printable municipal work order."*

### [2:05 – 2:50] Construction Progress: Before & After Comparative Audit
- **Visual:** Switch to **Construction Progress**. Upload two real phone photos of the same spot (`BEFORE` and `AFTER` a visible change—such as a wall, scaffolding, or repair work) and click **Run Progression Analysis**. Scrub the interactive `BeforeAfterSlider` with SAM 3.1 overlays enabled, then show the `Progress Index`, the element-by-element quantitative delta table (`Before Area`, `After Area`, `Delta`, `Status`), `DualSignalCards`, and Muse Spark’s comparative engineering summary.
- **Voiceover:** *"The same core pipeline also powers Before-and-After construction and repair comparison. Uploading baseline and current photos segments structural and hazard concepts across both states. Inspectors can scrub the interactive comparison slider, inspect the relative area change between BEFORE and AFTER in the table, and read Muse Spark’s comparative summary."*

### [2:50 – 3:00] Closing
- **Visual:** Return to the Civic Map and Reports archive, showing the public GitHub repository (`https://github.com/Foxcrack/viaguard`) and MIT license.
- **Voiceover:** *"Built from scratch with Meta SAM 3.1 and Muse Spark: honest measurements, privacy by default, and faster civic maintenance. This is Viaguard."*

---

## 5. Pre-Submission Checklist

- [x] **Public Repository**: Repository is public and licensed under MIT (`https://github.com/Foxcrack/viaguard`).
- [x] **Git History Proof**: Commit history proves all development took place between Oct 27 and Nov 4, 2026.
- [x] **No Secrets Committed**: `.env` is strictly gitignored; full `git log -p` history verified clean.
- [x] **Meta Models Verified**: Strictly powered by `sam-3.1` and `muse-spark-1.3` via `https://api.meta.ai/v1`.
- [x] **Honest Live Mode & No Bundled Fake Cache**: Zero pre-cached responses are shipped in the repo (`data/` is gitignored). Live API mode runs by default and never falls back silently; opt-in Demo Mode only replays responses locally recorded by the user via `pnpm record:demo` with a visible `"Replaying cached real responses"` banner.
- [x] **Tests Passing**: 58 automated unit and integration tests passing (`pnpm test`).
- [x] **Submission Portal**: Official submission via https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit before November 4, 2026, 9:00 PM ET.
