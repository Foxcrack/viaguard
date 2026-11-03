import { describe, it, expect } from "vitest";
import {
  computeMapView,
  toLatLngTuple,
  isValidLatLng,
  SINGLE_PIN_ZOOM,
  WORLD_MAX_BOUNDS,
} from "../src/geo.js";

const CALI = { latitude: 3.4516, longitude: -76.532 };
const BOGOTA = { latitude: 4.711, longitude: -74.0721 };
const MEDELLIN = { latitude: 6.2442, longitude: -75.5812 };

describe("geo helpers (Leaflet [lat, lng] order)", () => {
  it("converts named locations to [lat, lng], never [lng, lat]", () => {
    expect(toLatLngTuple(CALI)).toEqual([3.4516, -76.532]);
  });

  it("rejects missing or out-of-range coordinates", () => {
    expect(toLatLngTuple(undefined)).toBeNull();
    // Swapped Sydney ([lng, lat] mistaken for [lat, lng]) puts 151 in the latitude slot: out of range
    expect(toLatLngTuple({ latitude: 151.2092, longitude: -33.8688 })).toBeNull();
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng(0, 0)).toBe(true);
  });

  it("documents that a swapped Cali pair is still in range (Antarctica), so order must come from named fields", () => {
    // Range validation alone cannot detect this swap; toLatLngTuple reads named fields, so order is fixed.
    const swapped = toLatLngTuple({ latitude: -76.532, longitude: 3.4516 });
    expect(swapped).toEqual([-76.532, 3.4516]);
    expect(swapped).not.toEqual(toLatLngTuple(CALI));
  });

  it("returns 'none' when there are no valid pins", () => {
    expect(computeMapView([])).toEqual({ kind: "none" });
    expect(computeMapView([undefined, null])).toEqual({ kind: "none" });
  });

  it("centers a single Cali pin at zoom 15 in [lat, lng] order", () => {
    const view = computeMapView([CALI]);
    expect(view).toEqual({ kind: "single", center: [3.4516, -76.532], zoom: SINGLE_PIN_ZOOM });
    expect(SINGLE_PIN_ZOOM).toBe(15);
  });

  it("treats duplicate coordinates as a single pin", () => {
    expect(computeMapView([CALI, { ...CALI }]).kind).toBe("single");
  });

  it("fits bounds around 3 reports in Cali, Bogotá and Medellín", () => {
    const view = computeMapView([CALI, BOGOTA, MEDELLIN, undefined]);
    expect(view).toEqual({
      kind: "bounds",
      bounds: [
        [3.4516, -76.532],
        [6.2442, -74.0721],
      ],
    });
  });

  it("exposes world max bounds clamped to ±85° latitude and ±180° longitude", () => {
    expect(WORLD_MAX_BOUNDS).toEqual([
      [-85, -180],
      [85, 180],
    ]);
  });
});
