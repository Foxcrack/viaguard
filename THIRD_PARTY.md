# Third-Party Dependencies and Assets

This file documents all third-party software libraries, UI components, cartographic tiles, and sample assets utilized by Viaguard along with their licenses and sources.

## Core Libraries & Frameworks

| Name | License | Purpose / URL |
|---|---|---|
| `pnpm` | MIT | Workspace package manager (https://pnpm.io) |
| `typescript` | Apache-2.0 | Type checking and language support |
| `vitest` | MIT | Unit and integration testing framework |
| `openai` | Apache-2.0 | Official OpenAI SDK used with Meta Model API (`https://api.meta.ai/v1`) |
| `@meta-sam/parser` | MIT / Meta | Official SAM token grammar parser, raster mask decoder, and SVG path generator |
| `hono` | MIT | High-performance HTTP framework for Node.js API |
| `@hono/node-server` | MIT | Node.js HTTP server adapter for Hono |
| `zod` | MIT | TypeScript-first schema validation |
| `sharp` | Apache-2.0 | Server-side image resizing, EXIF handling, and privacy Gaussian blur |
| `exifr` | MIT | Camera EXIF GPS metadata extraction |
| `react` & `react-dom` | MIT | User interface library |
| `react-router-dom` | MIT | Client-side routing |
| `tailwindcss` | MIT | Utility-first CSS styling framework |
| `lucide-react` | MIT | Clean civic-tech UI icons |
| `@hugeicons/react` & `@hugeicons/core-free-icons` | MIT | Icon primitives used by React Bits `Stepper` |
| `leaflet` & `react-leaflet` | BSD-2-Clause / MIT | Interactive OpenStreetMap geospatial viewer |
| `gsap` & `@gsap/react` | Standard "No Charge" GreenSock License | Timeline animations used by React Bits components |
| `motion` & `framer-motion` | MIT | Declarative motion primitives used by React Bits components |
| `clsx` & `tailwind-merge` | MIT | Conditional class merging utilities |

---

## React Bits Visual Layer (`apps/web/src/components/reactbits/`)

- **Catalog & Documentation**: https://reactbits.dev
- **Upstream Repository**: https://github.com/DavidHDev/react-bits
- **Installation Method**: `pnpm dlx shadcn@latest add @react-bits/<ComponentName>-TS-TW` (TypeScript + Tailwind variants copied as source into `apps/web/src/components/reactbits/`)

### Installed & Used React Bits Components (18 Components)

| Component (`@react-bits/*-TS-TW`) | Source Path | Pages / Modules Where Used | Role & Accessibility Notes |
|---|---|---|---|
| `Topography` | `apps/web/src/components/reactbits/Topography.tsx` | Home (`HomePage.tsx`) | Lazy-loaded canvas topographic contour hero background; replaced with static CSS gradient on `< 640px` or `prefers-reduced-motion: reduce` |
| `Noise` | `apps/web/src/components/reactbits/Noise.tsx` | Home (`HomePage.tsx`) | Lazy-loaded subtle low-opacity (`alpha=10`) grain overlay on Home only; disabled on `< 640px` or `prefers-reduced-motion: reduce` |
| `BlurText` | `apps/web/src/components/reactbits/BlurText.tsx` | Home (`HomePage.tsx`) | Hero headline entrance reveal; static plain `<h1>` rendered under `prefers-reduced-motion: reduce` |
| `ShinyText` | `apps/web/src/components/reactbits/ShinyText.tsx` | Home (`HomePage.tsx`) | Subtle metallic sheen on hero civic-tech badge (`disabled` when `prefersReducedMotion` is true) |
| `PillNav` | `apps/web/src/components/reactbits/PillNav.tsx` | Global Shell (`App.tsx`) | Desktop top navigation bar across Home, Road Damage, Construction, Civic Map, and Reports (paired with mobile bottom bar on `< 768px`) |
| `SpotlightCard` | `apps/web/src/components/reactbits/SpotlightCard.tsx` | Home (`HomePage.tsx`) | Pointer-reactive spotlight cards for the Road Damage and Construction Progress module entry cards |
| `GlareHover` | `apps/web/src/components/reactbits/GlareHover.tsx` | Home (`HomePage.tsx`) | Directional surface sheen wrapping the two primary inspection module cards |
| `StarBorder` | `apps/web/src/components/reactbits/StarBorder.tsx` | Home (`HomePage.tsx`), Road (`RoadPage.tsx`), Construction (`ConstructionPage.tsx`) | Highlighted border treatment reserved exclusively for the single primary CTA per page |
| `Magnet` | `apps/web/src/components/reactbits/Magnet.tsx` | Home (`HomePage.tsx`), Road (`RoadPage.tsx`), Construction (`ConstructionPage.tsx`) | Gentle magnetic pull on primary action and upload buttons (`disabled` on mobile or `prefers-reduced-motion`) |
| `ClickSpark` | `apps/web/src/components/reactbits/ClickSpark.tsx` | Home (`HomePage.tsx`), Road (`RoadPage.tsx`), Construction (`ConstructionPage.tsx`) | Micro-spark feedback on primary upload and analysis triggers |
| `Stepper` | `apps/web/src/components/reactbits/Stepper.tsx` | Road (`RoadPage.tsx`), Construction (`ConstructionPage.tsx`) via `InspectionProgressStepper.tsx` | 4-stage pipeline stepper (`Preprocess & EXIF` → `Muse Spark Scene` → `SAM 3.1 Masks` → `Municipal Report`) |
| `StatusMark` | `apps/web/src/components/reactbits/StatusMark.tsx` | Road (`RoadPage.tsx`), Construction (`ConstructionPage.tsx`) via `InspectionProgressStepper.tsx` | Animated `loading` / `success` / `error` status indicator per pipeline stage |
| `ThoughtLine` | `apps/web/src/components/reactbits/ThoughtLine.tsx` | Road (`RoadPage.tsx`), Construction (`ConstructionPage.tsx`) via `InspectionProgressStepper.tsx` | Live status telemetry feed announcing the active Meta Muse Spark / SAM 3.1 stage |
| `Scanner` | `apps/web/src/components/reactbits/Scanner.tsx` | Road (`RoadPage.tsx`), Construction (`ConstructionPage.tsx`) via `InspectionProgressStepper.tsx` | Lazy-loaded small-area (`76×76px`) canvas scan indicator while an inspection is running; static CSS fallback on mobile / reduced motion |
| `AnimatedList` | `apps/web/src/components/reactbits/AnimatedList.tsx` | Road (`RoadPage.tsx`) | Interactive keyboard- and click-navigable list of detected SAM 3.1 road defects |
| `CountUp` | `apps/web/src/components/reactbits/CountUp.tsx` | Home (`HomePage.tsx`), Civic Map (`MapPage.tsx`) | Tabular monospace numeric counters for total inspections, geolocated pins, high/critical hazards, and average severity |
| `MagicBento` | `apps/web/src/components/reactbits/MagicBento.tsx` | Home (`HomePage.tsx`) | 6-card civic capability bento grid highlighting Muse Spark, SAM 3.1, deterministic scoring, EXIF GPS, privacy blur, and work-order export |
| `FadeContent` | `apps/web/src/components/reactbits/FadeContent.tsx` | Home, Road, Construction, Map, Reports, Report Detail (via `SectionReveal.tsx`) | Scroll-triggered section fade-in; bypassed immediately when `prefers-reduced-motion: reduce` is active |

### Exact React Bits License Terms (`https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md`)

```text
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

The same restriction covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the sounds in the sound library. **You may not sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools or a substantially similar copy of them as a hosted service-whether alone, in a bundle, or as a ported version.**

What you make with the tools is yours to use. You can use exported code, images, videos, and audio files in any personal or commercial application, website, or product, including paid ones. **You may not sell or redistribute the exports on their own, either individually or as the product itself, such as a sound, texture, background, or template pack.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Map Tiles & Cartography
- **OpenStreetMap**: Map data and tile rendering © OpenStreetMap contributors, licensed under the Open Database License (ODbL).

## Sample Assets & Conformance Data
- **Synthetic Sample Input Images** (`apps/web/public/samples/`): Programmatically rendered 800×600 JPEG test input images (asphalt potholes, cracking networks, excavation pits, foundation walls, and scaffolding) generated via `sharp` vector compositing (`apps/api/src/generate-samples.ts`). Released under CC0 / MIT as sample input images only (not cached model responses).
