/**
 * Geospatial helpers shared by the web map.
 *
 * Coordinate order convention:
 * - Viaguard stores locations as named objects `{ latitude, longitude }` (never positional arrays).
 * - Leaflet expects positional tuples in `[lat, lng]` order.
 * - GeoJSON / some EXIF tooling use `[lng, lat]`; Viaguard never stores that form.
 * All conversion to positional tuples goes through `toLatLngTuple` so the order is defined in one place.
 */

/** Leaflet-ordered positional coordinate: `[latitude, longitude]`. */
export type LatLngTuple = [number, number];

/** Zoom level used when the map shows exactly one pin. */
export const SINGLE_PIN_ZOOM = 15;

/** Web Mercator latitude limit used to clamp the map so the world cannot repeat or overflow. */
export const MAP_MAX_LATITUDE = 85;

/** Map pan limits in Leaflet `[[south, west], [north, east]]` order. */
export const WORLD_MAX_BOUNDS: [LatLngTuple, LatLngTuple] = [
  [-MAP_MAX_LATITUDE, -180],
  [MAP_MAX_LATITUDE, 180],
];

export interface LatLngLike {
  latitude: number;
  longitude: number;
}

/** Returns true when latitude is in `[-90, 90]` and longitude is in `[-180, 180]`. */
export function isValidLatLng(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Converts a named `{ latitude, longitude }` location into a Leaflet `[lat, lng]` tuple.
 * Returns `null` for missing or out-of-range coordinates.
 */
export function toLatLngTuple(location: LatLngLike | null | undefined): LatLngTuple | null {
  if (!location) return null;
  const { latitude, longitude } = location;
  if (!isValidLatLng(latitude, longitude)) return null;
  return [latitude, longitude];
}

export type MapView =
  | { kind: "none" }
  | { kind: "single"; center: LatLngTuple; zoom: number }
  | { kind: "bounds"; bounds: [LatLngTuple, LatLngTuple] };

/**
 * Decides how the map should frame a set of pins:
 * - no valid pins: `none` (caller keeps its default view)
 * - one distinct pin: `single`, centered on it at `SINGLE_PIN_ZOOM`
 * - several distinct pins: `bounds` as `[[minLat, minLng], [maxLat, maxLng]]` for `fitBounds`
 */
export function computeMapView(
  locations: ReadonlyArray<LatLngLike | null | undefined>
): MapView {
  const points: LatLngTuple[] = [];
  const seen = new Set<string>();
  for (const loc of locations) {
    const tuple = toLatLngTuple(loc);
    if (!tuple) continue;
    const key = `${tuple[0]},${tuple[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(tuple);
  }

  if (points.length === 0) return { kind: "none" };
  if (points.length === 1) {
    return { kind: "single", center: points[0], zoom: SINGLE_PIN_ZOOM };
  }

  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return {
    kind: "bounds",
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
  };
}

