import { describe, it, expect } from "vitest";
import * as fs from "fs";
import sharp from "sharp";
import { preprocessImage } from "../src/pipeline.js";
import { toLatLngTuple } from "@viaguard/core";

/**
 * Builds a small JPEG with EXIF GPS tags in degrees/minutes/seconds (rationals),
 * exactly like a phone camera writes them.
 */
async function jpegWithGps(gps: {
  latRef: "N" | "S";
  lat: string;
  lngRef: "E" | "W";
  lng: string;
}): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 90, g: 90, b: 90 } },
  })
    .jpeg()
    .withExif({
      IFD3: {
        GPSLatitudeRef: gps.latRef,
        GPSLatitude: gps.lat,
        GPSLongitudeRef: gps.lngRef,
        GPSLongitude: gps.lng,
      },
    })
    .toBuffer();
}

describe("EXIF GPS coordinate order (preprocessImage -> Leaflet)", () => {
  it("reads Cali EXIF GPS as latitude ≈ 3.45 (N) and longitude ≈ -76.53 (W), never swapped", async () => {
    // Cali, Colombia: 3°27'5.76" N, 76°31'55.2" W
    const buffer = await jpegWithGps({
      latRef: "N",
      lat: "3/1 27/1 576/100",
      lngRef: "W",
      lng: "76/1 31/1 552/10",
    });

    const pre = await preprocessImage(buffer, "cali-exif.jpg");
    try {
      expect(pre.exifGps).toBeDefined();
      expect(pre.exifGps!.latitude).toBeCloseTo(3.4516, 4);
      expect(pre.exifGps!.longitude).toBeCloseTo(-76.532, 4);

      // Leaflet position must be [lat, lng]
      const leafletPosition = toLatLngTuple(pre.exifGps);
      expect(leafletPosition).not.toBeNull();
      expect(leafletPosition![0]).toBeCloseTo(3.4516, 4);
      expect(leafletPosition![1]).toBeCloseTo(-76.532, 4);
    } finally {
      if (fs.existsSync(pre.filePath)) fs.unlinkSync(pre.filePath);
    }
  });

  it("applies southern / eastern hemisphere refs as signed decimals (Sydney)", async () => {
    // Sydney: 33°52'7.68" S, 151°12'33.24" E
    const buffer = await jpegWithGps({
      latRef: "S",
      lat: "33/1 52/1 768/100",
      lngRef: "E",
      lng: "151/1 12/1 3324/100",
    });

    const pre = await preprocessImage(buffer, "sydney-exif.jpg");
    try {
      expect(pre.exifGps!.latitude).toBeCloseTo(-33.8688, 3);
      expect(pre.exifGps!.longitude).toBeCloseTo(151.2092, 3);
    } finally {
      if (fs.existsSync(pre.filePath)) fs.unlinkSync(pre.filePath);
    }
  });
});

