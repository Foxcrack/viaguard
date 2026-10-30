import React from "react";
import { InspectionReport, normalizeInspectionReport } from "@viaguard/core";
import { Eye, Info, Layers } from "lucide-react";

interface DualSignalCardsProps {
  report: InspectionReport;
}

export const DualSignalCards: React.FC<DualSignalCardsProps> = ({ report }) => {
  const normalized = normalizeInspectionReport(report);
  const measured = normalized.measuredSeverity!;
  const visual = normalized.visualCondition!;
  const instanceCount =
    measured.breakdown?.damageInstanceCount ?? normalized.findings.length;

  const measuredBadgeClass =
    measured.level === "critical" || measured.level === "high"
      ? "bg-red-500 text-white"
      : measured.level === "medium"
      ? "bg-amber-500 text-slate-950"
      : "bg-emerald-500 text-slate-950";

  const visualBadgeClass =
    visual.level === "critical" || visual.level === "poor"
      ? "bg-red-500/20 text-red-300 border border-red-500/40"
      : visual.level === "fair"
      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Signal 1: Measured severity (SAM) */}
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Measured severity (SAM)</span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-black uppercase tabular-nums ${measuredBadgeClass}`}
            >
              {measured.level} ({measured.score}/100)
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Deterministic score computed strictly from{" "}
            <strong className="font-mono text-slate-200">{instanceCount}</strong> discrete
            defect instance(s) segmented by SAM 3.1.
          </p>
        </div>

        {/* Signal 2: Visual condition (Muse Spark) */}
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Visual condition (Muse Spark)</span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold uppercase ${visualBadgeClass}`}
            >
              {visual.level}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{visual.explanation}</p>
        </div>
      </div>

      {/* Explicit discrepancy note when signals differ by >= 2 levels */}
      {normalized.signalDiscrepancyNote && (
        <div
          role="note"
          className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-amber-200 text-xs flex items-start space-x-2.5"
        >
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{normalized.signalDiscrepancyNote}</span>
        </div>
      )}
    </div>
  );
};
