import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SpotlightCard } from "../components/react-bits/SpotlightCard.tsx";
import { BlurText } from "../components/react-bits/BlurText.tsx";
import { CountUp } from "../components/react-bits/CountUp.tsx";
import { ShinyText } from "../components/react-bits/ShinyText.tsx";
import { api } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import {
  ShieldAlert,
  ArrowRight,
  HardHat,
  MapPin,
  FileText,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";

export const HomePage: React.FC = () => {
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getReports({ limit: 4 })
      .then((data) => setReports(data))
      .catch((err) => console.error("Error loading reports:", err))
      .finally(() => setLoading(false));
  }, []);

  const highCriticalCount = reports.filter(
    (r) => r.severityLevel === "high" || r.severityLevel === "critical"
  ).length;

  return (
    <div className="space-y-12 py-6">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Meta Global AI Developer Hackathon 2026</span>
          <span className="text-slate-500">&bull;</span>
          <ShinyText text="Build for Your World" speed={4} />
        </div>

        <div className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
          <BlurText text="Turn Phone Photos Into Actionable Civic Reports" animateBy="words" />
        </div>

        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Viaguard equips municipal public works inspectors with instant, sub-pixel damage segmentation via{" "}
          <strong className="text-slate-200">Meta SAM 3.1</strong> and automated engineering reasoning with{" "}
          <strong className="text-slate-200">Muse Spark</strong>.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            to="/road"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition flex items-center space-x-2 shadow-lg shadow-blue-600/20"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Audit Road Damage</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/construction"
            className="px-6 py-3 rounded-lg bg-surface hover:bg-surface/90 text-slate-200 border border-border font-semibold transition flex items-center space-x-2"
          >
            <HardHat className="w-4 h-4 text-amber-400" />
            <span>Compare Site Progress</span>
          </Link>
          <Link
            to="/map"
            className="px-6 py-3 rounded-lg bg-surface hover:bg-surface/90 text-slate-200 border border-border font-semibold transition flex items-center space-x-2"
          >
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>View Civic Map</span>
          </Link>
        </div>
      </section>

      {/* Modern Metrics Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
        <div className="bg-surface/60 border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-white">
            <CountUp to={reports.length} duration={1.2} />
          </div>
          <div className="text-xs text-slate-400 mt-1">Total Inspected Sites</div>
        </div>
        <div className="bg-surface/60 border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-red-400">
            <CountUp to={highCriticalCount} duration={1.2} />
          </div>
          <div className="text-xs text-slate-400 mt-1">High &amp; Critical Hazards</div>
        </div>
        <div className="bg-surface/60 border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-blue-400">SAM 3.1</div>
          <div className="text-xs text-slate-400 mt-1">1-Bit Stream Segmentation</div>
        </div>
        <div className="bg-surface/60 border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-emerald-400">Muse Spark</div>
          <div className="text-xs text-slate-400 mt-1">Scene Reasoning &amp; Diff</div>
        </div>
      </section>

      {/* Two Modules Section with SpotlightCards */}
      <section className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Two Modules &bull; One Unified Pipeline
          </h2>
          <p className="text-slate-400 text-sm">
            Both workflows execute deterministic scoring, relative area calculations, and official municipal report exports.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Module 1 Card */}
          <SpotlightCard
            className="flex flex-col justify-between hover:border-blue-500/50"
            spotlightColor="rgba(59, 130, 246, 0.15)"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">1. Road Damage Assessment</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Upload a street photo. Detects and measures potholes, alligator cracks, and roadbed deterioration. Automatic EXIF GPS extraction pins hazards directly on the municipal map.
              </p>
              <ul className="text-xs text-slate-400 space-y-2 pt-2">
                <li className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span>Deterministic Severity Index (0 to 100)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>Sub-pixel SAM 3.1 mask overlays &amp; relative area %</span>
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Link
                to="/road"
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition flex items-center justify-center space-x-2"
              >
                <span>Launch Road Inspector</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </SpotlightCard>

          {/* Module 2 Card */}
          <SpotlightCard
            className="flex flex-col justify-between hover:border-amber-500/50"
            spotlightColor="rgba(245, 158, 11, 0.15)"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <HardHat className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">2. Construction Progress</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Upload BEFORE and AFTER photos of the same job site. Quantifies structural progression (scaffolding, concrete walls) and alerts on safety deterioration or debris buildup.
              </p>
              <ul className="text-xs text-slate-400 space-y-2 pt-2">
                <li className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span>Comparative Diff Table with Volumetric Delta %</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Draggable Before/After Visual Comparison Slider</span>
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Link
                to="/construction"
                className="w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition flex items-center justify-center space-x-2"
              >
                <span>Launch Construction Diff</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </SpotlightCard>
        </div>
      </section>

      {/* Recent Inspection Reports Preview */}
      <section className="max-w-5xl mx-auto space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Recent Municipal Audits</h2>
          </div>
          <Link to="/reports" className="text-xs text-blue-400 hover:underline flex items-center space-x-1">
            <span>View All Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm bg-surface rounded-xl border border-border">
            No inspection reports recorded yet. Upload a photo in the Road or Construction module to generate your first audit.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {reports.slice(0, 4).map((report) => (
              <Link
                key={report.id}
                to={`/reports/${report.id}`}
                className="group bg-surface rounded-xl border border-border p-3.5 hover:border-slate-600 transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  {report.imageUrl && (
                    <img
                      src={report.imageUrl}
                      alt={report.title}
                      className="w-full h-28 object-cover rounded-lg group-hover:opacity-90 transition"
                    />
                  )}
                  <div className="font-semibold text-xs text-white line-clamp-1">
                    {report.title}
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                        report.severityLevel === "critical"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : report.severityLevel === "high"
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          : report.severityLevel === "medium"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {report.severityLevel} ({report.severityScore}/100)
                    </span>
                    <span className="text-slate-500 capitalize">{report.module}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
