# Viaguard – Hackathon Submission

**Meta Global AI Developer Hackathon 2026**  
**Track:** Indie Developer  
**Theme:** Build for Your World  
**Repository:** https://github.com/TWFoxcrack/viaguard  
**License:** MIT  

---

## 1. Project Description (150 Words)

Municipal public works agencies struggle with slow, manual infrastructure inspections. Citizens report potholes, roadbed deterioration, and construction delays, but converting smartphone photos into prioritized repair orders takes days. 

**Viaguard** is an intelligent civic infrastructure inspection platform powered directly by Meta's AI models. Using **SAM 3.1**, Viaguard performs sub-pixel 1-bit streaming segmentation, calculating exact relative surface area percentages and vector boundaries of potholes, alligator cracks, and structural elements. Using **Muse Spark**, Viaguard provides deep engineering scene reasoning, comparative construction progression diffing, and automated report generation. 

With automatic EXIF GPS geolocation, an interactive municipal map, a deterministic severity scoring engine (0–100), automated privacy protection blurring, and printable work orders, Viaguard transforms any phone photo into an immediate, actionable municipal asset. Viaguard empowers cities to fix hazardous roads faster, verify contractor milestones objectively, and protect public safety.

---

## 2. What Was Built During the Hackathon

Every line of code, architecture diagram, and test in this repository was built from scratch between **October 27, 2026, and November 4, 2026**:
- **Monorepo Architecture**: Clean pnpm workspace dividing `@viaguard/core`, `@viaguard/api`, and `@viaguard/web`.
- **Meta Model API Client**: Native OpenAI SDK integration with Meta's endpoint (`https://api.meta.ai/v1`), disk caching, token tracking, and exponential backoff retry.
- **Official SAM Parser**: Deep integration of `@meta-sam/parser` (`parseImageStream`, `decodeMaskToRaster`, and `decodeMaskToSVGPath`) for real-time streaming segmentation and raster area computation.
- **Deterministic Severity Engine**: Mathematically verified formula in `packages/core` calculating objective hazard levels without hallucinated metrics.
- **Geospatial Mapping**: Full OpenStreetMap / Leaflet integration with severity-coded pins and auto-populated EXIF GPS coordinates.
- **Comparative Construction Diffing**: Quantitative element delta tracker comparing BEFORE/AFTER site photos with an interactive draggable comparison slider.
- **Civic Privacy Protection**: Automated segmentation and 25px Gaussian blurring of pedestrians and vehicle license plates.
- **Testing**: 21 automated Vitest unit and integration tests covering scoring, diffing, schemas, API routes, and privacy filters.

---

## 3. How Meta's Models Are Used

Viaguard depends strictly on Meta's models through the official Meta Model API:

### `sam-3.1` (Segmentation Model)
- Invoked via the Responses API with `stream: true`.
- Evaluates individual short noun phrase concept prompts (e.g., `"pothole"`, `"crack"`, `"concrete wall"`, `"scaffolding"`).
- Employs 1-bit mask encoding (`metadata: { mask_encoding: "one_bit", include_confidence: "true" }`) for ultra-compact payloads.
- Stream chunks are parsed in real time using `@meta-sam/parser`. Decoded into row-major binary rasters to calculate exact relative surface area percentages and converted to vector SVG paths for client-side overlays.

### `muse-spark-1.3` (Reasoning & Vision Model)
- **Scene Understanding**: Inspects raw uploaded images with strict structured JSON output to classify road/site conditions and suggest dynamic concept prompts for SAM.
- **Construction Diff Reasoning**: Compares BEFORE and AFTER physical measurements, evaluating genuine structural progress versus safety hazards or debris accumulation.
- **Municipal Report Authoring**: Synthesizes measurements into official municipal repair directives, cold-patching recommendations, and urgency tiers.

---

## 4. Three-Minute Demo Video Script

**Target Video Length:** 3:00 (180 seconds)

### [0:00 – 0:20] The Problem: Municipal Backlog & Road Hazards
- **Visual:** Opening on a real road photo with a deep pothole. Cut to headline animation in Viaguard.
- **Voiceover:** *"Every day, municipal public works departments receive hundreds of citizen reports about road damage. But manual inspections are slow, subjective, and difficult to prioritize. How can city engineers turn a simple phone photo into an immediate, measured work order? Meet Viaguard."*

### [0:20 – 1:15] Road Damage Inspection & Meta AI Pipeline
- **Visual:** Inspector uploads a photo of a damaged street. EXIF GPS badge automatically lights up with coordinates. Inspector clicks "Run Inspection Audit". Live progress stepper animates through pipeline stages.
- **Voiceover:** *"Viaguard takes any smartphone photo. It instantly reads camera EXIF GPS tags to pin the exact location. Next, Meta’s Muse Spark model performs scene reasoning, identifying asphalt breakdown and selecting targeted concepts. Then, Meta’s SAM 3.1 model performs 1-bit streaming segmentation."*

### [1:15 – 2:05] Interactive Mask Overlays, Scoring & Civic Map
- **Visual:** The photo renders with bright vector mask overlays over the pothole. The inspector hovers over findings, toggling SAM masks and bounding boxes. Severity score displays 78/100 (HIGH). Cut to the Civic Map showing color-coded pins across the city. Click "Export PDF Report" to reveal the official work order.
- **Voiceover:** *"Using the official @meta-sam/parser, Viaguard decodes the raster masks to measure exact relative damage coverage—here, a 6.8% sensor void. Our deterministic scoring formula assigns an objective hazard rating of 78 out of 100. The damage is pinned to our live municipal map, and with one click, public works has a complete, printable work order with cold-patching specifications."*

### [2:05 – 2:50] Construction Progress: Before & After Comparative Diff
- **Visual:** Navigate to Construction module. Load BEFORE (excavation) and AFTER (concrete wall & scaffolding) photos. Click "Run Construction Progression Diff". Draggable comparison slider scrubs between baseline and current state. The quantitative delta table displays concrete wall (+20% area) and scaffolding (+12% area), yielding a +65 Progress Index.
- **Voiceover:** *"Viaguard's core pipeline also powers comparative construction monitoring. We upload a BEFORE baseline and an AFTER photo. Viaguard segments matching structural elements across both epochs. Our interactive comparison slider lets project managers inspect changes visually, while our quantitative diff engine calculates exact element delta percentages. Muse Spark then audits structural progress, verifying that foundation walls were poured on schedule while alerting on debris."*

### [2:50 – 3:00] Closing & Civic Impact
- **Visual:** Full view of the Civic Map. Show GitHub repository and MIT license badge.
- **Voiceover:** *"Built entirely with Meta SAM 3.1 and Muse Spark, Viaguard turns everyday phone photos into actionable civic intelligence. Safer roads, verified job sites, and smarter cities. Thank you!"*

---

## 5. Pre-Submission Checklist

- [x] **Public Repository**: Repository is public and licensed under MIT (`https://github.com/TWFoxcrack/viaguard`).
- [x] **Git History Proof**: Commit history proves all development took place between Oct 27 and Nov 4, 2026.
- [x] **No Secrets Committed**: `.env` is strictly gitignored; `.env.example` provides empty placeholders.
- [x] **Meta Models Verified**: Strictly powered by `sam-3.1` and `muse-spark-1.3` via the Meta Model API.
- [x] **Offline Resilience**: Demo Mode fallback verified for seamless judge evaluation.
- [x] **Tests Passing**: 21 unit and integration tests passing (`pnpm test`).
- [x] **Submission Deadline**: Submitted before November 4, 2026, 9:00 PM ET via https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit

