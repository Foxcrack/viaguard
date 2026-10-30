import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { SectionReveal } from "@/components/SectionReveal";
import { api } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import { MaskOverlayViewer } from "../components/MaskOverlayViewer.tsx";
import { InspectionMap } from "../components/InspectionMap.tsx";
import { CachedReplayBanner, useDemoMode } from "../context/DemoModeContext.tsx";
import { Printer, ArrowLeft, MapPin, Calendar, HardHat, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { demoMode } = useDemoMode();

  useEffect(() => {
    if (!id) return;
    api
      .getReportById(id)
      .then((data) => setReport(data))
      .catch((err) => setError(err.message || "Failed to load inspection report"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm">
        Loading inspection report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="text-red-400 font-semibold">{error || "Report not found"}</div>
        <Link to="/reports" className="text-blue-400 text-xs hover:underline inline-flex items-center space-x-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Reports Archive</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-4 max-w-5xl mx-auto">
      {/* Top Navigation & Actions Bar */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Link
          to="/reports"
          className="text-slate-400 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Archive</span>
        </Link>

        <div className="flex items-center space-x-3">
          <a
            href={`/api/reports/${report.id}/export`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface/90 border border-border text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print / Save PDF</span>
          </a>
          <a
            href={`/api/reports/${report.id}/export?format=json`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface/90 border border-border text-slate-400 hover:text-white text-xs font-mono transition"
          >
            Raw JSON
          </a>
        </div>
      </div>

      {/* Main Report Header (calm & fast — no heavy backgrounds on Report pages) */}
      <CachedReplayBanner active={Boolean(report.isCached) && !demoMode} compact />
      <SectionReveal>
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-2 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center space-x-1">
                {report.module === "road" ? (
                  <ShieldAlert className="w-3.5 h-3.5" />
                ) : (
                  <HardHat className="w-3.5 h-3.5" />
                )}
                <span>{report.module}</span>
              </span>
              <span className="text-slate-400 flex items-center space-x-1 font-mono text-[11px]">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(report.createdAt).toLocaleString()}</span>
              </span>
              {report.privacyBlurApplied !== false && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/35 text-blue-300 font-mono text-[11px] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Privacy blur: on</span>
                </span>
              )}
            </div>

            <span
              className={`px-3 py-1 rounded-full font-mono text-xs font-black uppercase tabular-nums ${
                report.severityLevel === "critical" || report.severityLevel === "high"
                  ? "bg-red-500 text-white"
                  : report.severityLevel === "medium"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-emerald-500 text-slate-950"
              }`}
            >
              {report.severityLevel} SEVERITY ({report.severityScore}/100)
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{report.title}</h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
            {report.summary}
          </p>

          <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-border/80 text-xs">
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Recommended Action</div>
              <div className="text-slate-200 font-semibold mt-0.5">{report.recommendedAction}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Estimated Urgency</div>
              <div className="text-slate-200 font-semibold mt-0.5">{report.estimatedUrgency}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Classification</div>
              <div className="text-slate-200 font-semibold mt-0.5">{report.sceneType} ({report.overallCondition})</div>
            </div>
          </div>
        </div>
      </SectionReveal>

      {/* Primary Image Overlay (crisp & untouched — no decorative effects) */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Meta SAM 3.1 Sub-Pixel Segmentation Map</span>
        </h2>
        <MaskOverlayViewer
          imageUrl={report.imageUrl}
          imageWidth={report.imageWidth}
          imageHeight={report.imageHeight}
          findings={report.findings}
          title={report.title}
          privacyBlurApplied={report.privacyBlurApplied !== false}
          privacyRegionsBlurred={report.privacyRegionsBlurred}
        />
      </div>

      {/* Findings Table */}
      <SectionReveal>
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 overflow-x-auto">
          <h3 className="text-base font-bold text-white">Measured Defects Breakdown</h3>
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-background/80 border-b border-border text-slate-400 uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Target Element</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
                <th className="py-2.5 px-3 text-center">Relative Area %</th>
                <th className="py-2.5 px-3">Bounding Box Coordinates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.findings.map((f, i) => (
                <tr key={f.id || i} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-semibold text-white capitalize">{f.concept}</td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums">{(f.confidence * 100).toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums">{f.relativeAreaPercent}%</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 tabular-nums">
                    [{f.boundingBox.x1}, {f.boundingBox.y1}, {f.boundingBox.x2}, {f.boundingBox.y2}]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionReveal>

      {/* Geolocation Section if Available (crisp & untouched Leaflet map) */}
      {report.location && (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>Inspection Geolocation</span>
            </h3>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              Source: {report.location.source.toUpperCase()} &bull; Lat: {report.location.latitude.toFixed(5)}, Lng: {report.location.longitude.toFixed(5)}
            </span>
          </div>
          <div className="h-64 rounded-xl overflow-hidden border border-border">
            <InspectionMap reports={[report]} zoom={15} className="h-full w-full" />
          </div>
        </div>
      )}
    </div>
  );
};

