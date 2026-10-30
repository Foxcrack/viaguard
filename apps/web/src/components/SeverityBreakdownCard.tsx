import React from "react";
import { InspectionReport, calculateSeverity } from "@viaguard/core";
import { Calculator } from "lucide-react";

interface SeverityBreakdownCardProps {
  report: InspectionReport;
  compact?: boolean;
}

export const SeverityBreakdownCard: React.FC<SeverityBreakdownCardProps> = ({
  report,
  compact = false,
}) => {
  const breakdown =
    report.severityBreakdown ??
    calculateSeverity(report.afterFindings ?? report.findings).breakdown;

  const weightEntries = Object.entries(breakdown.appliedTypeWeights);

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-3.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center space-x-2 font-bold text-sm text-white">
          <Calculator className="w-4 h-4 text-blue-400" />
          <span>Severity Score Breakdown</span>
        </div>
        <span className="font-mono text-xs text-slate-300 tabular-nums">
          Raw <strong className="text-white">{breakdown.rawScore}</strong> &rarr;{" "}
          <strong className="text-blue-400">{breakdown.finalScore}/100</strong>
        </span>
      </div>

      <div className={`grid gap-3 ${compact ? " sm:grid-cols-3" : "sm:grid-cols-3"}`}>
        {/* 1. Total Damaged Area */}
        <div className="bg-background/70 rounded-xl border border-border p-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Damaged Area</span>
            <span className="font-mono text-slate-500">max 50</span>
          </div>
          <div className="text-base font-extrabold font-mono text-white tabular-nums">
            {breakdown.totalAreaScore} <span className="text-xs font-normal text-slate-400">pts</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
            Raw: {breakdown.rawTotalAreaPercent}% &bull; Eff: {breakdown.weightedTotalArea}%
          </div>
        </div>

        {/* 2. Largest Single Defect */}
        <div className="bg-background/70 rounded-xl border border-border p-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Largest Single Defect</span>
            <span className="font-mono text-slate-500">max 40</span>
          </div>
          <div className="text-base font-extrabold font-mono text-white tabular-nums">
            {breakdown.largestInstanceScore}{" "}
            <span className="text-xs font-normal text-slate-400">pts</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
            Raw: {breakdown.largestInstanceRawAreaPercent}% &bull; Eff:{" "}
            {breakdown.largestInstanceWeightedArea}%
          </div>
        </div>

        {/* 3. Instance Count Bonus */}
        <div className="bg-background/70 rounded-xl border border-border p-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Instance Count Bonus</span>
            <span className="font-mono text-slate-500">max +10</span>
          </div>
          <div className="text-base font-extrabold font-mono text-white tabular-nums">
            +{breakdown.countBonus}{" "}
            <span className="text-xs font-normal text-slate-400">pts</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
            {breakdown.damageInstanceCount} defect(s) &bull; Conf:{" "}
            {(breakdown.averageConfidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Confidence & Type Weights Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
        <div>
          <span className="text-slate-500">Applied Type Weights: </span>
          {weightEntries.length > 0 ? (
            <span className="font-mono text-slate-200">
              {weightEntries.map(([concept, weight]) => `${concept} (${weight}×)`).join(", ")}
            </span>
          ) : (
            <span className="font-mono text-slate-500">none (0 damage instances)</span>
          )}
        </div>
        <div className="font-mono text-slate-400 tabular-nums">
          Mean SAM Confidence: {(breakdown.averageConfidence * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

