# Viaguard Sample Images

This directory stores road damage and construction progress sample input images.

> **Honesty & Attribution Note**: The four bundled `.jpg` files in this folder (`road-sample-pothole.jpg`, `road-sample-cracks.jpg`, `construction-before-site.jpg`, and `construction-after-site.jpg`) are **programmatically generated synthetic test illustrations** created with `sharp` SVG compositing (`apps/api/src/generate-samples.ts`), as documented in [`THIRD_PARTY.md`](../../../../THIRD_PARTY.md). They are sample *input* images only — **no pre-cached API responses are bundled in this repository**.

## Instructions
You can upload your own real smartphone photos directly in the web UI, or place `.jpg`, `.jpeg`, `.png`, or `.webp` test images here:

- **Road Damage**: Photos of asphalt or concrete streets showing potholes, longitudinal or alligator cracks, patches, or manhole covers. Photos taken on a smartphone with camera EXIF GPS coordinates enabled will automatically populate the geolocation map.
- **Construction Progress**: Pairs of BEFORE and AFTER photos of the same spot (e.g., a wall, scaffolding, street repair, or job site near you with a visible physical change between shots).

Any image files placed in this directory are indexed by `/api/demo/samples` and selectable from the UI sample picker.
