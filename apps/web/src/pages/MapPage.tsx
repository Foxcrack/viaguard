import React, { useEffect, useState } from "react";
import CountUp from "@/components/reactbits/CountUp";
import { SectionReveal } from "@/components/SectionReveal";
import { api } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import { InspectionMap } from "../components/InspectionMap.tsx";
import { MapPin, Filter, Layers, ShieldAlert, HardHat } from "lucide-react";

export const MapPage: React.FC = () => {
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");

  useEffect(() => {
    api
      .getReports()
      .then((data) => setReports(data))
      .catch((err) => console.error("Error loading map reports:", err))
      .finally(() => setLoading(false));
  }, []);

  const filteredReports = reports.filter((r) => {
    const matchSev =
      selectedSeverity === "all" || r.severityLevel === selectedSeverity;
    const matchMod =
      selectedModule === "all" || r.module === selectedModule;
    return matchSev && matchMod;
  });

  const geocodedCount = reports.filter((r) => r.location).length;
  const criticalCount = reports.filter(
    (r) => r.severityLevel === "high" || r.severityLevel === "critical"
  ).length;

  return (
    <div className="space-y-6 py-2 max-w-6xl mx-auto">
      {/* Header (calm & fast — no WebGL backgrounds on Map page) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
            Geospatial Command View
          </span>
          <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <MapPin className="w-7 h-7 text-blue-400" />
            <span>Municipal Infrastructure Map</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Severity-coded geospatial pins from EXIF GPS and inspector coordinates.
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-surface border border-border px-4 py-2.5 rounded-2xl text-center">
            <div className="font-mono font-extrabold text-lg text-white tabular-nums">
              <CountUp to={geocodedCount} duration={0.9} />
            </div>
            <div className="text-slate-400 text-[11px]">Geolocated Pins</div>
          </div>
          <div className="bg-surface border border-border px-4 py-2.5 rounded-2xl text-center">
            <div className="font-mono font-extrabold text-lg text-red-400 tabular-nums">
              <CountUp to={criticalCount} duration={0.9} />
            </div>
            <div className="text-slate-400 text-[11px]">High / Critical</div>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <SectionReveal>
        <div className="bg-surface rounded-2xl border border-border p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-slate-300">Severity:</span>
            {["all", "low", "medium", "high", "critical"].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSelectedSeverity(sev)}
                className={`min-h-[34px] px-3 py-1 rounded-lg font-medium capitalize transition ${
                  selectedSeverity === sev
                    ? "bg-blue-600 text-white font-semibold"
                    : "bg-background text-slate-400 border border-border hover:text-white"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-slate-300">Module:</span>
            <button
              type="button"
              onClick={() => setSelectedModule("all")}
              className={`min-h-[34px] px-3 py-1 rounded-lg font-medium transition ${
                selectedModule === "all"
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-background text-slate-400 border border-border hover:text-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedModule("road")}
              className={`min-h-[34px] px-3 py-1 rounded-lg font-medium transition flex items-center space-x-1 ${
                selectedModule === "road"
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-background text-slate-400 border border-border hover:text-white"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Road</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedModule("construction")}
              className={`min-h-[34px] px-3 py-1 rounded-lg font-medium transition flex items-center space-x-1 ${
                selectedModule === "construction"
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-background text-slate-400 border border-border hover:text-white"
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Construction</span>
            </button>
          </div>
        </div>
      </SectionReveal>

      {/* Crisp untouched Leaflet Map View */}
      {loading ? (
        <div className="h-[550px] rounded-2xl border border-border bg-surface flex items-center justify-center text-slate-400 text-sm">
          Loading map layers and pins...
        </div>
      ) : (
        <div className="h-[550px] w-full rounded-2xl overflow-hidden border border-border shadow-2xl">
          <InspectionMap reports={filteredReports} className="h-full w-full" zoom={13} />
        </div>
      )}
    </div>
  );
};
