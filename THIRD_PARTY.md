# Third-Party Dependencies and Assets

This file documents all third-party software libraries, tools, and assets utilized by Viaguard along with their licenses and sources.

## Core Libraries & Frameworks

| Name | License | Purpose / URL |
|---|---|---|
| `pnpm` | MIT | Package manager (https://pnpm.io) |
| `typescript` | Apache-2.0 | Type checking and language support |
| `vitest` | MIT | Unit testing framework |
| `openai` | Apache-2.0 | Official OpenAI SDK used with Meta Model API `https://api.meta.ai/v1` |
| `@meta-sam/parser` | MIT / Meta | Official SAM token grammar parser and mask raster decoder |
| `hono` | MIT | High-performance web framework for Node.js API |
| `@hono/node-server` | MIT | Node.js HTTP server adapter for Hono |
| `zod` | MIT | TypeScript-first schema validation |
| `sharp` | Apache-2.0 | Image resizing, metadata extraction, format conversions |
| `exifr` | MIT | Fast client/server EXIF GPS extraction |
| `better-sqlite3` | MIT | Embedded SQLite database for reports and detections |
| `react` & `react-dom` | MIT | User interface library |
| `react-router-dom` | MIT | Client-side routing |
| `tailwindcss` | MIT | Utility-first CSS styling framework |
| `lucide-react` | MIT | Clean UI icons |
| `leaflet` & `react-leaflet` | BSD-2-Clause / MIT | Interactive OpenStreetMap viewer |
| `framer-motion` | MIT | Animation library for React |
| `clsx` & `tailwind-merge` | MIT | Utility class merging |

## Map Tiles & Cartography
- **OpenStreetMap**: Map data and tile rendering © OpenStreetMap contributors, licensed under the Open Database License (ODbL).

## Design & UI Components
- **React Bits** (https://reactbits.dev): Curated modern UI components (SpotlightCard, AnimatedList, BlurText, ShinyText, CountUp) adapted for clean civic-tech design.


## Sample Assets & Conformance Data
- **Synthetic Demo Images** (`apps/web/public/samples/`): Programmatically rendered high-contrast test fixtures (asphalt potholes, cracking networks, excavation pits, foundation walls, and scaffolding) generated via Sharp vector compositing. Released into the public domain (CC0) / MIT for hackathon testing and reproducible offline evaluation.
