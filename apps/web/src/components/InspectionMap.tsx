import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { InspectionReport, normalizeInspectionReport } from "@viaguard/core";
import { Link } from "react-router-dom";
import { Navigation } from "lucide-react";

interface InspectionMapProps {
  reports: InspectionReport[];
  center?: [number, number];
  zoom?: number;
  interactiveSelect?: boolean;
  selectedLocation?: { latitude: number; longitude: number } | null;
  onLocationSelect?: (loc: { latitude: number; longitude: number }) => void;
  className?: string;
}

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
      onSelect?.({
        latitude: Number(e.latlng.lat.toFixed(6)),
        longitude: Number(e.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

export const InspectionMap: React.FC<InspectionMapProps> = ({
  reports,
  center = [37.7749, -122.4194], // Default to San Francisco
  zoom = 12,
  interactiveSelect = false,
  selectedLocation,
  onLocationSelect,
  className = "h-[450px] w-full rounded-xl overflow-hidden border border-border shadow-lg",
}) => {
  // Determine center from first report with valid location if available
  const reportWithLoc = reports.find((r) => r.location);
  const initialCenter: [number, number] = selectedLocation
    ? [selectedLocation.latitude, selectedLocation.longitude]
    : reportWithLoc?.location
    ? [reportWithLoc.location.latitude, reportWithLoc.location.longitude]
    : center;

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", background: "#111827" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {interactiveSelect && <LocationPickerEvents onSelect={onLocationSelect} />}

        {/* Selected manual location marker */}
        {selectedLocation && (
          <Marker
            position={[selectedLocation.latitude, selectedLocation.longitude]}
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
        {reports
          .filter((r) => r.location)
          .map((rawReport) => {
            const report = normalizeInspectionReport(rawReport);
            const loc = report.location!;
            const pinColor =
              SEVERITY_COLORS[report.severityLevel] || SEVERITY_COLORS.low;

            return (
              <Marker
                key={report.id}
                position={[loc.latitude, loc.longitude]}
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
