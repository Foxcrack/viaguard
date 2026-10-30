import React, { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import { InspectionMap } from "../components/InspectionMap.tsx";
import { CountUp } from "../components/react-bits/CountUp.tsx";
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
    <div className="space-y-6 py-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <MapPin className="w-7 h-7 text-emerald-400" />
            <span>Municipal Infrastructure Map</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time geospatial visualization of road damage and construction audits.
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-surface border border-border px-3.5 py-2 rounded-xl text-center">
            <div className="font-extrabold text-lg text-white">
              <CountUp to={geocodedCount} />
            </div>
            <div className="text-slate-400 text-[11px]">Geolocated Pins</div>
          </div>
          <div className="bg-surface border border-border px-3.5 py-2 rounded-xl text-center">
            <div className="font-extrabold text-lg text-red-400">
              <CountUp to={criticalCount} />
            </div>
            <div className="text-slate-400 text-[11px]">High / Critical</div>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-surface rounded-xl border border-border p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-slate-300">Filter Severity:</span>
          {["all", "low", "medium", "high", "critical"].map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSelectedSeverity(sev)}
              className={`px-2.5 py-1 rounded font-medium capitalize transition ${
                selectedSeverity === sev
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-surface text-slate-400 border border-border hover:text-white"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-300">Module:</span>
          <button
            type="button"
            onClick={() => setSelectedModule("all")}
            className={`px-2.5 py-1 rounded font-medium transition ${
              selectedModule === "all"
                ? "bg-slate-700 text-white font-semibold"
                : "bg-surface text-slate-400 border border-border hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSelectedModule("road")}
            className={`px-2.5 py-1 rounded font-medium transition flex items-center space-x-1 ${
              selectedModule === "road"
                ? "bg-blue-600 text-white font-semibold"
                : "bg-surface text-slate-400 border border-border hover:text-white"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Road</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedModule("construction")}
            className={`px-2.5 py-1 rounded font-medium transition flex items-center space-x-1 ${
              selectedModule === "construction"
                ? "bg-amber-600 text-white font-semibold"
                : "bg-surface text-slate-400 border border-border hover:text-white"
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>Construction</span>
          </button>
        </div>
      </div>

      {/* Map View */}
      {loading ? (
        <div className="h-[550px] rounded-xl border border-border bg-surface flex items-center justify-center text-slate-500 text-sm">
          Loading map layers and pins...
        </div>
      ) : (
        <div className="h-[550px] w-full rounded-xl overflow-hidden border border-border shadow-2xl">
          <InspectionMap reports={filteredReports} className="h-full w-full" zoom={13} />
        </div>
      )}
    </div>
  );
};
