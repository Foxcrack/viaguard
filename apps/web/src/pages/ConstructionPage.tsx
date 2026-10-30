import React, { useState, useEffect } from "react";
import { api, DemoSample, ProgressState } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider.tsx";
import {
  HardHat,
  UploadCloud,
  FileCheck2,
  Printer,
  RotateCcw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Layers,
} from "lucide-react";

export const ConstructionPage: React.FC = () => {
  const [beforeFile, setBeforeFile] = useState<File | Blob | null>(null);
  const [afterFile, setAfterFile] = useState<File | Blob | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [samples, setSamples] = useState<DemoSample[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);

  useEffect(() => {
    api.getSamples().then((all) => {
      setSamples(all.filter((s) => s.module === "construction"));
    });
  }, []);

  const handleBeforeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBeforeFile(file);
      setBeforePreview(URL.createObjectURL(file));
      setReport(null);
      setError(null);
    }
  };

  const handleAfterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAfterFile(file);
      setAfterPreview(URL.createObjectURL(file));
      setReport(null);
      setError(null);
    }
  };

  const handleLoadSamplePair = async () => {
    try {
      const beforeSample = samples.find((s) => s.variant === "before") || samples[0];
      const afterSample = samples.find((s) => s.variant === "after") || samples[1];

      if (!beforeSample || !afterSample) {
        setError("Sample pair not found in public assets.");
        return;
      }

      const [resBefore, resAfter] = await Promise.all([
        fetch(beforeSample.url),
        fetch(afterSample.url),
      ]);

      const [blobBefore, blobAfter] = await Promise.all([
        resBefore.blob(),
        resAfter.blob(),
      ]);

      setBeforeFile(blobBefore);
      setBeforePreview(beforeSample.url);
      setAfterFile(blobAfter);
      setAfterPreview(afterSample.url);
      setReport(null);
      setError(null);
    } catch {
      setError("Failed to load demo construction sample pair.");
    }
  };

  const handleStartAnalysis = async () => {
    if (!beforeFile || !afterFile) return;
    setAnalyzing(true);
    setError(null);
    setProgress({ step: "Initializing dual comparative pipeline...", percent: 5 });

    try {
      const result = await api.analyzeConstructionProgress(
        beforeFile,
        afterFile,
        (p) => setProgress(p)
      );
      setReport(result);
    } catch (err: any) {
      console.error("Construction analysis error:", err);
      setError(err.message || "Failed to complete construction progression analysis.");
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  };

  const handleReset = () => {
    setBeforeFile(null);
    setAfterFile(null);
    setBeforePreview(null);
    setAfterPreview(null);
    setReport(null);
    setError(null);
    setProgress(null);
  };

  return (
    <div className="space-y-8 py-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <HardHat className="w-8 h-8 text-amber-400" />
            <span>Construction Progress &bull; Before &amp; After</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Quantify structural progress, track newly erected elements, and detect site deterioration across time.
          </p>
        </div>
        {report && (
          <button
            onClick={handleReset}
            className="self-start md:self-auto px-4 py-2 rounded-lg bg-surface hover:bg-surface/90 border border-border text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Audit Another Job Site</span>
          </button>
        )}
      </div>

      {!report ? (
        <div className="space-y-6">
          {/* Dual Upload Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* 1. BEFORE Photo */}
            <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-amber-400 flex items-center space-x-1.5">
                  <span>1. BEFORE Photo (Baseline)</span>
                </span>
                <span className="text-xs text-slate-500">Earlier State</span>
              </div>

              {beforePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border bg-black/40 h-64 flex items-center justify-center">
                  <img
                    src={beforePreview}
                    alt="Before preview"
                    className="w-full h-full object-contain block"
                  />
                  <button
                    onClick={() => {
                      setBeforeFile(null);
                      setBeforePreview(null);
                    }}
                    className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 hover:bg-black/90 text-slate-300 text-xs font-medium backdrop-blur transition"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-border hover:border-amber-500/60 rounded-xl p-8 h-64 flex flex-col items-center justify-center cursor-pointer transition bg-surface/40 hover:bg-amber-500/5 group">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="mt-3 font-medium text-xs text-slate-200">
                    Upload BEFORE inspection photo
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleBeforeChange}
                  />
                </label>
              )}
            </div>

            {/* 2. AFTER Photo */}
            <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-emerald-400 flex items-center space-x-1.5">
                  <span>2. AFTER Photo (Current)</span>
                </span>
                <span className="text-xs text-slate-500">Later State</span>
              </div>

              {afterPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border bg-black/40 h-64 flex items-center justify-center">
                  <img
                    src={afterPreview}
                    alt="After preview"
                    className="w-full h-full object-contain block"
                  />
                  <button
                    onClick={() => {
                      setAfterFile(null);
                      setAfterPreview(null);
                    }}
                    className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 hover:bg-black/90 text-slate-300 text-xs font-medium backdrop-blur transition"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-border hover:border-emerald-500/60 rounded-xl p-8 h-64 flex flex-col items-center justify-center cursor-pointer transition bg-surface/40 hover:bg-emerald-500/5 group">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="mt-3 font-medium text-xs text-slate-200">
                    Upload AFTER inspection photo
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAfterChange}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Quick Demo Sample Button */}
          <div className="bg-surface/50 border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-400">
              Need sample data to evaluate? Test comparative analysis instantly:
            </div>
            <button
              type="button"
              onClick={handleLoadSamplePair}
              className="px-4 py-2 rounded-lg bg-surface hover:bg-slate-800 border border-border text-slate-200 hover:text-white font-medium transition flex items-center space-x-2"
            >
              <span>🏗️</span>
              <span>Load Verified Construction Before/After Pair</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Analysis Error</div>
                <div className="text-xs mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {analyzing && progress && (
            <div className="bg-surface rounded-xl border border-amber-500/40 p-6 space-y-4 shadow-xl shadow-amber-500/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-400 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Comparing Construction Epochs with Meta Models</span>
                </span>
                <span className="font-bold text-slate-200">{progress.percent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="text-xs text-slate-300 font-medium">
                {progress.step}
              </div>
            </div>
          )}

          {/* Launch Button */}
          <button
            type="button"
            disabled={!beforeFile || !afterFile || analyzing}
            onClick={handleStartAnalysis}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition flex items-center justify-center space-x-2 shadow-lg ${
              !beforeFile || !afterFile || analyzing
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-border"
                : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25"
            }`}
          >
            <FileCheck2 className="w-5 h-5" />
            <span>{analyzing ? "Computing Comparative Diff..." : "Run Construction Progression Diff"}</span>
          </button>
        </div>
      ) : (
        /* Results View */
        <div className="space-y-8">
          {/* Progress Assessment Header */}
          {report.constructionDiff && (
            <div
              className={`p-6 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                report.constructionDiff.progressScore >= 20
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : report.constructionDiff.progressScore <= -15
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-slate-800/40 border-slate-700"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase flex items-center space-x-1 ${
                      report.constructionDiff.progressScore >= 20
                        ? "bg-emerald-500 text-white"
                        : report.constructionDiff.progressScore <= -15
                        ? "bg-red-500 text-white"
                        : "bg-slate-600 text-white"
                    }`}
                  >
                    {report.constructionDiff.progressScore >= 20 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : report.constructionDiff.progressScore <= -15 ? (
                      <TrendingDown className="w-3.5 h-3.5" />
                    ) : null}
                    <span>
                      PROGRESS INDEX: {report.constructionDiff.progressScore > 0 ? "+" : ""}
                      {report.constructionDiff.progressScore} / 100
                    </span>
                  </span>
                  <span className="text-xs text-slate-400">
                    ID: <strong>{report.id}</strong>
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white">{report.title}</h2>
                <p className="text-xs text-slate-300 max-w-2xl">
                  {report.constructionDiff.overallAssessment}
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <a
                  href={`/api/reports/${report.id}/export`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-lg bg-surface hover:bg-surface/90 border border-border text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Export Report</span>
                </a>
              </div>
            </div>
          )}

          {/* Draggable Comparison Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 font-medium text-slate-200">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Interactive Draggable Comparison Slider</span>
                <span className="text-slate-500">(Drag center divider horizontally)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOverlays(!showOverlays)}
                className={`px-2.5 py-1 rounded border transition ${
                  showOverlays
                    ? "bg-amber-600/20 text-amber-300 border-amber-500/40"
                    : "bg-surface text-slate-400 border-border hover:text-white"
                }`}
              >
                {showOverlays ? "Hide SAM Overlays" : "Show SAM Overlays"}
              </button>
            </div>

            <BeforeAfterSlider
              beforeImageUrl={report.imageUrl}
              afterImageUrl={report.afterImageUrl || report.imageUrl}
              imageWidth={report.imageWidth}
              imageHeight={report.imageHeight}
              beforeFindings={report.findings}
              afterFindings={report.afterFindings}
              showOverlays={showOverlays}
            />
          </div>

          {/* Quantitative Diff Breakdown Table */}
          {report.constructionDiff && (
            <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-white">
                  Quantitative Element Delta Measurements
                </h3>
                <span className="text-xs text-slate-400">
                  Computed via exact SAM 3.1 decoded rasters
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 border-b border-border text-slate-400 uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Target Element</th>
                      <th className="py-2.5 px-3 text-center">Before Count</th>
                      <th className="py-2.5 px-3 text-center">After Count</th>
                      <th className="py-2.5 px-3 text-center">Delta Count</th>
                      <th className="py-2.5 px-3 text-center">Delta Area %</th>
                      <th className="py-2.5 px-3 text-right">Evaluation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.constructionDiff.conceptChanges.map((c) => (
                      <tr key={c.concept} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-semibold text-white capitalize">
                          {c.concept}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{c.beforeCount}</td>
                        <td className="py-3 px-3 text-center font-mono">{c.afterCount}</td>
                        <td
                          className={`py-3 px-3 text-center font-mono font-bold ${
                            c.deltaCount > 0
                              ? "text-emerald-400"
                              : c.deltaCount < 0
                              ? "text-red-400"
                              : "text-slate-500"
                          }`}
                        >
                          {c.deltaCount >= 0 ? "+" : ""}
                          {c.deltaCount}
                        </td>
                        <td
                          className={`py-3 px-3 text-center font-mono font-bold ${
                            c.deltaAreaPercent > 0
                              ? "text-emerald-400"
                              : c.deltaAreaPercent < 0
                              ? "text-red-400"
                              : "text-slate-500"
                          }`}
                        >
                          {c.deltaAreaPercent >= 0 ? "+" : ""}
                          {c.deltaAreaPercent}%
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.status === "progress"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : c.status === "deterioration"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Muse Spark Reasoning Summary */}
          <div className="grid md:grid-cols-2 gap-6 text-xs">
            <div className="bg-surface rounded-xl border border-border p-5 space-y-2">
              <div className="font-bold text-sm text-white">Visual Reasoning Assessment</div>
              <p className="text-slate-300 leading-relaxed">{report.summary}</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5 space-y-2">
              <div className="font-bold text-sm text-white">Recommended Site Action</div>
              <p className="text-slate-300 leading-relaxed">{report.recommendedAction}</p>
              <div className="pt-2 text-[11px] text-slate-500">
                Estimated follow-up urgency: <strong className="text-slate-300">{report.estimatedUrgency}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
