import React, { useState, useEffect } from "react";
import Magnet from "@/components/reactbits/Magnet";
import StarBorder from "@/components/reactbits/StarBorder";
import ClickSpark from "@/components/reactbits/ClickSpark";
import { SectionReveal } from "@/components/SectionReveal";
import { InspectionProgressStepper } from "@/components/InspectionProgressStepper";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { api, DemoSample, ProgressState } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider.tsx";
import { useDemoMode, CachedReplayBanner } from "../context/DemoModeContext.tsx";
import {
  HardHat,
  UploadCloud,
  FileCheck2,
  Printer,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Layers,
  ShieldCheck,
} from "lucide-react";

export const ConstructionPage: React.FC = () => {
  const { prefersReducedMotion, isSmallScreen } = useMotionPreferences();
  const { demoMode } = useDemoMode();

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
  const [privacyBlur, setPrivacyBlur] = useState(true);

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
      setError("Failed to load construction sample pair.");
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
        (p) => setProgress(p),
        demoMode,
        privacyBlur
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
    <div className="space-y-8 py-2 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
            Module 02 &bull; Comparative Site Audit
          </span>
          <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <HardHat className="w-7 h-7 text-blue-400" />
            <span>Construction Progress &bull; Before &amp; After</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Quantify structural progress, track newly erected elements, and detect site deterioration across time.
          </p>
        </div>
        {report && (
          <button
            type="button"
            onClick={handleReset}
            className="self-start md:self-auto min-h-[42px] px-4 py-2 rounded-xl bg-surface hover:bg-slate-800 border border-border text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-2 transition"
          >
            <RotateCcw className="w-4 h-4 text-blue-400" />
            <span>Audit Another Job Site</span>
          </button>
        )}
      </div>

      {!report ? (
        <SectionReveal className="space-y-6">
          {/* Dual Upload Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* 1. BEFORE Photo */}
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">
                  1. BEFORE Photo (Baseline)
                </span>
                <span className="font-mono text-xs text-slate-400">Earlier Epoch</span>
              </div>

              {beforePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border bg-black/50 h-64 flex items-center justify-center">
                  <img
                    src={beforePreview}
                    alt="Before preview"
                    className="w-full h-full object-contain block"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBeforeFile(null);
                      setBeforePreview(null);
                    }}
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-slate-200 text-xs font-medium border border-white/10 transition"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-border hover:border-blue-500/60 rounded-2xl p-8 h-64 flex flex-col items-center justify-center cursor-pointer transition bg-background/50 hover:bg-blue-500/5 group">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 group-hover:scale-105 transition">
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
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">
                  2. AFTER Photo (Current)
                </span>
                <span className="font-mono text-xs text-slate-400">Later Epoch</span>
              </div>

              {afterPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border bg-black/50 h-64 flex items-center justify-center">
                  <img
                    src={afterPreview}
                    alt="After preview"
                    className="w-full h-full object-contain block"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAfterFile(null);
                      setAfterPreview(null);
                    }}
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-slate-200 text-xs font-medium border border-white/10 transition"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-border hover:border-blue-500/60 rounded-2xl p-8 h-64 flex flex-col items-center justify-center cursor-pointer transition bg-background/50 hover:bg-blue-500/5 group">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 group-hover:scale-105 transition">
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

          {/* Sample Pair Loader & Privacy Blur Toggle */}
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyBlur}
                  onChange={(e) => setPrivacyBlur(e.target.checked)}
                  className="rounded border-border bg-slate-900 text-blue-500 focus:ring-blue-500"
                />
                <span className="font-medium text-slate-300">
                  Privacy Protection (Auto-blur site personnel &amp; license plates)
                </span>
              </label>
              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold border ${
                  privacyBlur
                    ? "bg-blue-500/15 border-blue-500/35 text-blue-300"
                    : "bg-slate-800 border-border text-slate-400"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>{privacyBlur ? "Privacy blur: on" : "Privacy blur: off"}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-slate-400">
                Load bundled construction before/after test images (<code className="font-mono text-[11px]">apps/web/public/samples/</code>):
              </div>
              <ClickSpark sparkColor="#60a5fa" disabled={prefersReducedMotion}>
                <Magnet padding={24} magnetStrength={2} disabled={prefersReducedMotion || isSmallScreen}>
                  <button
                    type="button"
                    onClick={handleLoadSamplePair}
                    className="min-h-[38px] px-4 py-2 rounded-xl bg-background hover:bg-slate-800 border border-border text-slate-200 hover:text-white font-semibold transition"
                  >
                    Load Construction Before/After Pair
                  </button>
                </Magnet>
              </ClickSpark>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-200 text-sm flex items-start space-x-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-100">Analysis Error</div>
                <div className="text-xs mt-1 text-red-200/90 leading-relaxed">{error}</div>
              </div>
            </div>
          )}

          {/* SSE Stepper */}
          {analyzing && progress && (
            <InspectionProgressStepper progress={progress} mode="construction" />
          )}

          {/* Main CTA Button */}
          {!beforeFile || !afterFile || analyzing ? (
            <button
              type="button"
              disabled
              className="min-h-[48px] w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-slate-800/80 text-slate-500 cursor-not-allowed border border-border flex items-center justify-center space-x-2"
            >
              <FileCheck2 className="w-5 h-5" />
              <span>
                {analyzing ? "Computing Comparative Diff..." : "Run Construction Progression Diff"}
              </span>
            </button>
          ) : (
            <ClickSpark
              sparkColor="#60a5fa"
              disabled={prefersReducedMotion}
              className="w-full block"
            >
              <Magnet
                padding={36}
                magnetStrength={2.5}
                disabled={prefersReducedMotion || isSmallScreen}
                wrapperClassName="w-full block"
                innerClassName="w-full block"
              >
                <StarBorder
                  type="button"
                  onClick={handleStartAnalysis}
                  color="#3b82f6"
                  trailColor="#93c5fd"
                  backgroundColor="#1d4ed8"
                  textColor="#ffffff"
                  radius={12}
                  duration={5}
                  sparkle={!prefersReducedMotion}
                  className="w-full font-bold text-sm cursor-pointer shadow-lg shadow-blue-600/25"
                >
                  <FileCheck2 className="w-5 h-5" />
                  <span>Run Construction Progression Diff</span>
                </StarBorder>
              </Magnet>
            </ClickSpark>
          )}
        </SectionReveal>
      ) : (
        /* Results View */
        <SectionReveal className="space-y-8">
          <CachedReplayBanner active={Boolean(report.isCached) && !demoMode} compact />

          {/* Progress Assessment Header */}
          {report.constructionDiff && (
            <div
              className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                report.constructionDiff.progressScore >= 20
                  ? "bg-emerald-500/10 border-emerald-500/35"
                  : report.constructionDiff.progressScore <= -15
                  ? "bg-red-500/10 border-red-500/35"
                  : "bg-surface border-border"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded font-mono text-xs font-bold uppercase flex items-center space-x-1 ${
                      report.constructionDiff.progressScore >= 20
                        ? "bg-emerald-500 text-slate-950"
                        : report.constructionDiff.progressScore <= -15
                        ? "bg-red-500 text-white"
                        : "bg-blue-600 text-white"
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
                  <span className="font-mono text-xs text-slate-400">
                    ID: <strong className="text-slate-200">{report.id}</strong>
                  </span>
                  {report.privacyBlurApplied !== false && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/35 text-blue-300 font-mono text-xs font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span>Privacy blur: on</span>
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-white">{report.title}</h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  {report.constructionDiff.overallAssessment}
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <a
                  href={`/api/reports/${report.id}/export`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[42px] px-4 py-2.5 rounded-xl bg-surface hover:bg-slate-800 border border-border text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <Printer className="w-4 h-4 text-blue-400" />
                  <span>Export Report</span>
                </a>
              </div>
            </div>
          )}

          {/* Crisp untouched Draggable Comparison Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 font-medium text-slate-200">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Interactive Draggable Comparison Slider</span>
                <span className="text-slate-500 hidden sm:inline">
                  (Drag center divider horizontally)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOverlays(!showOverlays)}
                className={`min-h-[34px] px-3 py-1 rounded-lg border font-medium transition ${
                  showOverlays
                    ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
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
            <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-white">
                  Quantitative Element Delta Measurements
                </h3>
                <span className="font-mono text-xs text-slate-400">
                  SAM 3.1 decoded rasters
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-background/80 border-b border-border text-slate-400 uppercase text-[11px]">
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
                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          {c.beforeCount}
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          {c.afterCount}
                        </td>
                        <td
                          className={`py-3 px-3 text-center font-mono font-bold tabular-nums ${
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
                          className={`py-3 px-3 text-center font-mono font-bold tabular-nums ${
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
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
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
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-2">
              <div className="font-bold text-sm text-white">Visual Reasoning Assessment</div>
              <p className="text-slate-300 leading-relaxed">{report.summary}</p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-2">
              <div className="font-bold text-sm text-white">Recommended Site Action</div>
              <p className="text-slate-300 leading-relaxed">{report.recommendedAction}</p>
              <div className="pt-2 text-[11px] text-slate-400">
                Estimated follow-up urgency:{" "}
                <strong className="font-mono text-slate-200">{report.estimatedUrgency}</strong>
              </div>
            </div>
          </div>
        </SectionReveal>
      )}
    </div>
  );
};
