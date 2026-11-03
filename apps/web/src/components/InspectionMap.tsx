import React, { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  InspectionReport,
  normalizeInspectionReport,
  computeMapView,
  toLatLngTuple,
  WORLD_MAX_BOUNDS,
  SINGLE_PIN_ZOOM,
  type LatLngTuple,
} from "@viaguard/core";
import { Link } from "react-router-dom";
import { Navigation } from "lucide-react";

interface InspectionMapProps {
  reports: InspectionReport[];
  /** Fallback center (Leaflet [lat, lng]) used only when there are no pins. */
  center?: LatLngTuple;
  /** Fallback zoom used only when there are no pins. */
  zoom?: number;
  interactiveSelect?: boolean;
  selectedLocation?: { latitude: number; longitude: number } | null;
  onLocationSelect?: (loc: { latitude: number; longitude: number }) => void;
  className?: string;
}

/** Lowest zoom allowed; together with noWrap + maxBounds this prevents repeated world copies. */
const MAP_MIN_ZOOM = 2;

/** Padding (px) applied when fitting the map to multiple pins. */
const FIT_BOUNDS_PADDING: [number, number] = [48, 48];

/** Neutral whole-world fallback view when no pins exist. */
const WORLD_FALLBACK_CENTER: LatLngTuple = [15, 0];

const NONE_VIEW_KEY = JSON.stringify({ kind: "none" });

const SEVERITY_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#991b1b",
};

function createCustomPin(color: string) {
  return L.divIcon({
    className: "custom-map-pin",
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        border: 2px solid #ffffff;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background-color: #ffffff;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

function LocationPickerEvents({
  onSelect,
}: {
  onSelect?: (loc: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(e) {
      // Clamp longitude into [-180, 180] in case the click lands outside the single world copy.
      const wrapped = e.latlng.wrap();
      onSelect?.({
        latitude: Number(wrapped.lat.toFixed(6)),
        longitude: Number(wrapped.lng.toFixed(6)),
      });
    },
  });
  return null;
}

/**
 * Keeps Leaflet's cached container size in sync with the DOM so tiles never render offset:
 * calls invalidateSize() after mount and whenever the container is resized (layout, sidebar, viewport).
 */
function MapSizeSync() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;
    const invalidate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    };

    invalidate();
    const settleTimer = window.setTimeout(invalidate, 250);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(invalidate);
      observer.observe(container);
    } else {
      window.addEventListener("resize", invalidate);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      if (observer) observer.disconnect();
      else window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
}

/**
 * Frames the map around its pins: fitBounds (with padding) for several pins,
 * or centers on a single pin at zoom 15. Re-runs only when the set of pins changes.
 * In interactive picker mode it does not override the user's zoom on every click.
 */
function MapAutoFit({
  points,
  interactive,
}: {
  points: Array<{ latitude: number; longitude: number }>;
  interactive: boolean;
}) {
  const map = useMap();
  const view = useMemo(() => computeMapView(points), [points]);
  const viewKey = JSON.stringify(view);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const previousKey = lastKeyRef.current;
    if (previousKey === viewKey) return;
    lastKeyRef.current = viewKey;

    if (view.kind === "none") return;

    // Make sure Leaflet knows the real container size before computing the framing.
    map.invalidateSize({ pan: false });

    if (view.kind === "single") {
      if (interactive && previousKey !== null && previousKey !== NONE_VIEW_KEY) {
        // User is adjusting the pin by clicking: keep their zoom, only pan if the pin left the view.
        if (!map.getBounds().contains(view.center)) {
          map.panTo(view.center);
        }
        return;
      }
      map.setView(view.center, SINGLE_PIN_ZOOM);
      return;
    }

    map.fitBounds(view.bounds, { padding: FIT_BOUNDS_PADDING, maxZoom: SINGLE_PIN_ZOOM });
  }, [map, view, viewKey, interactive]);

  return null;
}

export const InspectionMap: React.FC<InspectionMapProps> = ({
  reports,
  center = WORLD_FALLBACK_CENTER,
  zoom = MAP_MIN_ZOOM,
  interactiveSelect = false,
  selectedLocation,
  onLocationSelect,
  className = "h-[450px] w-full rounded-xl overflow-hidden border border-border shadow-lg",
}) => {
  // Normalize once and keep only reports with valid coordinates (Leaflet order: [lat, lng]).
  const pinnedReports = useMemo(
    () =>
      reports
        .map((raw) => normalizeInspectionReport(raw))
        .map((report) => ({ report, position: toLatLngTuple(report.location) }))
        .filter(
          (entry): entry is { report: InspectionReport; position: LatLngTuple } =>
            entry.position !== null
        ),
    [reports]
  );

  const selectedPosition = toLatLngTuple(selectedLocation);
  const selectedLat = selectedPosition?.[0];
  const selectedLng = selectedPosition?.[1];

  const fitPoints = useMemo(() => {
    const pts = pinnedReports.map(({ position }) => ({
      latitude: position[0],
      longitude: position[1],
    }));
    if (selectedLat !== undefined && selectedLng !== undefined) {
      pts.push({ latitude: selectedLat, longitude: selectedLng });
    }
    return pts;
  }, [pinnedReports, selectedLat, selectedLng]);

  // Initial view before MapAutoFit runs (avoids a flash at the fallback location).
  const initialView = computeMapView(fitPoints);
  const initialCenter: LatLngTuple =
    initialView.kind === "single"
      ? initialView.center
      : initialView.kind === "bounds"
      ? [
          (initialView.bounds[0][0] + initialView.bounds[1][0]) / 2,
          (initialView.bounds[0][1] + initialView.bounds[1][1]) / 2,
        ]
      : center;
  const initialZoom = initialView.kind === "single" ? SINGLE_PIN_ZOOM : Math.max(zoom, MAP_MIN_ZOOM);

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        minZoom={MAP_MIN_ZOOM}
        maxBounds={WORLD_MAX_BOUNDS}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", minHeight: "11rem", background: "#111827" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          noWrap={true}
          bounds={WORLD_MAX_BOUNDS}
          maxZoom={19}
        />

        <MapSizeSync />
        <MapAutoFit points={fitPoints} interactive={interactiveSelect} />

        {interactiveSelect && <LocationPickerEvents onSelect={onLocationSelect} />}

        {/* Selected manual location marker */}
        {selectedLocation && selectedPosition && (
          <Marker
            position={selectedPosition}
            icon={createCustomPin("#3b82f6")}
          >
            <Popup>
              <div className="text-xs p-1">
                <strong>Manual Pin Placed</strong>
                <div>{selectedLocation.latitude}, {selectedLocation.longitude}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Report Pin Markers */}
        {pinnedReports.map(({ report, position }) => {
            const pinColor =
              SEVERITY_COLORS[report.severityLevel] || SEVERITY_COLORS.low;

            return (
              <Marker
                key={report.id}
                position={position}
                icon={createCustomPin(pinColor)}
              >
                <Popup className="custom-popup">
                  <div className="w-60 text-slate-800 text-xs">
                    {report.imageUrl && (
                      <img
                        src={report.imageUrl}
                        alt={report.title}
                        className="w-full h-24 object-cover rounded mb-2"
                      />
                    )}
                    <div className="font-bold text-sm text-slate-900 line-clamp-1">
                      {report.title}
                    </div>
                    <div className="space-y-1 my-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Measured severity (SAM):</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white"
                          style={{ backgroundColor: pinColor }}
                        >
                          {report.severityLevel} ({report.severityScore}/100)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Visual condition (Muse Spark):</span>
                        <span className="font-semibold uppercase text-slate-800">
                          {report.visualCondition?.level ?? report.overallCondition}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-600 line-clamp-2 mb-2">
                      {report.summary}
                    </p>
                    <Link
                      to={`/reports/${report.id}`}
                      className="block text-center py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
                    >
                      View Full Report
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      {interactiveSelect && (
        <div className="absolute top-3 right-3 z-[1000] bg-surface/90 backdrop-blur px-3 py-1.5 rounded-lg border border-border text-xs text-slate-300 flex items-center space-x-1.5 shadow">
          <Navigation className="w-3.5 h-3.5 text-blue-400" />
          <span>Click map to place or adjust inspection pin</span>
        </div>
      )}
    </div>
  );
};
