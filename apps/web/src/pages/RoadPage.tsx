import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import AnimatedList, { type AnimatedListEntry } from "@/components/reactbits/AnimatedList";
import Magnet from "@/components/reactbits/Magnet";
import StarBorder from "@/components/reactbits/StarBorder";
import ClickSpark from "@/components/reactbits/ClickSpark";
import { SectionReveal } from "@/components/SectionReveal";
import { InspectionProgressStepper } from "@/components/InspectionProgressStepper";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { api, DemoSample, ProgressState } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import { MaskOverlayViewer } from "../components/MaskOverlayViewer.tsx";
import { InspectionMap } from "../components/InspectionMap.tsx";
import { useDemoMode, CachedReplayBanner } from "../context/DemoModeContext.tsx";
import {
  UploadCloud,
  MapPin,
  Compass,
  FileCheck2,
  Printer,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

export const RoadPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { prefersReducedMotion, isSmallScreen } = useMotionPreferences();
  const { demoMode } = useDemoMode();

  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [samples, setSamples] = useState<DemoSample[]>([]);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    source: "browser" | "manual";
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [privacyBlur, setPrivacyBlur] = useState(true);

  useEffect(() => {
    api.getSamples().then((all) => {
      setSamples(all.filter((s) => s.module === "road"));
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setReport(null);
      setError(null);
    }
  };

  const handleSampleSelect = async (sample: DemoSample) => {
    try {
      const res = await fetch(sample.url);
      const blob = await res.blob();
      setSelectedFile(blob);
      setPreviewUrl(sample.url);
      setReport(null);
      setError(null);
    } catch {
      setError("Failed to fetch demo sample image.");
    }
  };

  const handleUseBrowserLocation = () => {
    if (!navigator.geolocation) {
      setError("Browser geolocation is not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          source: "browser",
        });
      },
      (err) => {
        setError(
          `Geolocation error: ${err.message}. Click directly on the map below to place a pin manually.`
        );
      }
    );
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setError(null);
    setProgress({ step: "Initializing pipeline...", percent: 5 });

    try {
      const result = await api.analyzeRoadDamage(
        selectedFile,
        location || undefined,
        (p) => setProgress(p),
        demoMode,
        privacyBlur
      );
      setReport(result);
    } catch (err: any) {
      console.error("Road analysis error:", err);
      setError(err.message || "Failed to complete road damage inspection.");
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setReport(null);
    setError(null);
    setProgress(null);
    setSelectedFindingId(null);
  };

  const animatedFindingItems: AnimatedListEntry[] = useMemo(() => {
    if (!report) return [];
    return report.findings.map((f) => ({
      id: f.id,
      title: f.concept,
      description: `Relative Area: ${f.relativeAreaPercent}%`,
      meta: `${(f.confidence * 100).toFixed(0)}%`,
    }));
  }, [report]);

  return (
    <div className="space-y-8 py-2 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
            Module 01 &bull; Roadway Surface Audit
          </span>
          <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">
            Road Damage Inspection
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Detect, measure, and geolocate potholes, alligator cracks, and roadbed deterioration using Meta SAM 3.1 &amp; Muse Spark.
          </p>
        </div>
        {report && (
          <button
            type="button"
            onClick={handleReset}
            className="self-start md:self-auto min-h-[42px] px-4 py-2 rounded-xl bg-surface hover:bg-slate-800 border border-border text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-2 transition"
          >
            <RotateCcw className="w-4 h-4 text-blue-400" />
            <span>Audit Another Street</span>
          </button>
        )}
      </div>

      {/* Main Flow: Upload vs Analysis Results */}
      {!report ? (
        <SectionReveal>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Left Column: Image Upload & Preview */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-white">Upload Street Photo</span>
                  <span className="font-mono text-xs text-slate-400">
                    Max 10 MB &bull; JPEG, PNG, WebP
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {previewUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-border bg-black/50">
                    <img
                      src={previewUrl}
                      alt="Inspection preview"
                      className="w-full h-72 object-contain block"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/80 hover:bg-black text-slate-200 hover:text-white text-xs font-semibold border border-white/10 transition"
                    >
                      Change Image
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload street photo"
                    className="border-2 border-dashed border-border hover:border-blue-500/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-background/50 hover:bg-blue-500/5"
                  >
                    <ClickSpark sparkColor="#60a5fa" disabled={prefersReducedMotion}>
                      <Magnet padding={28} magnetStrength={2.2} disabled={prefersReducedMotion || isSmallScreen}>
                        <span className="px-4 py-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-300 text-xs font-semibold inline-flex items-center gap-2">
                          <UploadCloud className="w-4 h-4 text-blue-400" />
                          <span>Select Street Photo</span>
                        </span>
                      </Magnet>
                    </ClickSpark>
                    <span className="mt-3 font-medium text-sm text-slate-200">
                      Click to browse or drop road image
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      EXIF GPS coordinates are read automatically before resizing
                    </span>
                  </div>
                )}

                {/* Privacy Blur Toggle (ON by default) */}
                <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyBlur}
                      onChange={(e) => setPrivacyBlur(e.target.checked)}
                      className="rounded border-border bg-slate-900 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-300">
                      Privacy Protection (Auto-blur pedestrians &amp; license plates)
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

                {/* Sample Images Quick Selector */}
                <div className="pt-2">
                  <div className="text-xs text-slate-400 mb-2 font-medium">
                    Sample test images (<code className="font-mono text-[11px]">apps/web/public/samples/</code>):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {samples.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleSampleSelect(sample)}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-background/80 hover:bg-slate-800 border border-border text-xs text-slate-300 hover:text-white transition"
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-200 text-sm flex items-start space-x-3"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-red-100">Inspection Failed</div>
                    <div className="text-xs mt-1 text-red-200/90 leading-relaxed">{error}</div>
                  </div>
                </div>
              )}

              {/* SSE Progress Stepper (Stepper + StatusMark + ThoughtLine + lazy Scanner) */}
              {analyzing && progress && (
                <InspectionProgressStepper progress={progress} mode="road" />
              )}
            </div>

            {/* Right Column: Geolocation & Main CTA */}
            <div className="space-y-6">
              <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-white flex items-center space-x-1.5">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span>Geographic Pin</span>
                  </span>
                  {location && (
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {location.source}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Phone EXIF GPS coordinates populate automatically on upload, or set a pin below:
                </p>

                <button
                  type="button"
                  onClick={handleUseBrowserLocation}
                  className="min-h-[40px] w-full py-2 px-3 rounded-xl bg-background/80 hover:bg-slate-800 border border-border text-xs text-slate-200 font-medium transition flex items-center justify-center space-x-1.5"
                >
                  <Compass className="w-4 h-4 text-blue-400" />
                  <span>Use Current Device Location</span>
                </button>

                {/* Crisp untouched map picker */}
                <div className="h-44 rounded-xl overflow-hidden border border-border">
                  <InspectionMap
                    reports={[]}
                    interactiveSelect={true}
                    selectedLocation={location}
                    onLocationSelect={(loc) => setLocation({ ...loc, source: "manual" })}
                    className="h-full w-full"
                  />
                </div>

                {location && (
                  <div className="text-[11px] text-slate-300 font-mono text-center tabular-nums">
                    {location.latitude}, {location.longitude}
                  </div>
                )}
              </div>

              {/* Primary CTA Button (StarBorder + Magnet + ClickSpark when enabled) */}
              {!selectedFile || analyzing ? (
                <button
                  type="button"
                  disabled
                  className="min-h-[48px] w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-slate-800/80 text-slate-500 cursor-not-allowed border border-border flex items-center justify-center space-x-2"
                >
                  <FileCheck2 className="w-5 h-5" />
                  <span>{analyzing ? "Running Inspection..." : "Run Inspection Audit"}</span>
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
                      <span>Run Inspection Audit</span>
                    </StarBorder>
                  </Magnet>
                </ClickSpark>
              )}
            </div>
          </div>
        </SectionReveal>
      ) : (
        /* Results View */
        <SectionReveal className="space-y-8">
          <CachedReplayBanner active={Boolean(report.isCached) && !demoMode} compact />

          {/* Top Banner: Severity colors strictly for severity */}
          <div
            className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              report.severityLevel === "critical" || report.severityLevel === "high"
                ? "bg-red-500/10 border-red-500/35"
                : report.severityLevel === "medium"
                ? "bg-amber-500/10 border-amber-500/35"
                : "bg-emerald-500/10 border-emerald-500/35"
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded font-mono text-xs font-bold uppercase ${
                    report.severityLevel === "critical" || report.severityLevel === "high"
                      ? "bg-red-500 text-white"
                      : report.severityLevel === "medium"
                      ? "bg-amber-500 text-slate-950"
                      : "bg-emerald-500 text-slate-950"
                  }`}
                >
                  {report.severityLevel} SEVERITY ({report.severityScore}/100)
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
                {report.summary}
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
                <span>Export PDF / Print</span>
              </a>
              <Link
                to="/map"
                className="min-h-[42px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <MapPin className="w-4 h-4" />
                <span>Locate on Map</span>
              </Link>
            </div>
          </div>

          {/* Crisp Mask Overlay Viewer (NO decorative effects) & AnimatedList Findings */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <MaskOverlayViewer
                imageUrl={report.imageUrl}
                imageWidth={report.imageWidth}
                imageHeight={report.imageHeight}
                findings={report.findings}
                selectedFindingId={selectedFindingId}
                onSelectFinding={setSelectedFindingId}
                title="SAM 3.1 Road Damage Mask Segmentation"
                privacyBlurApplied={report.privacyBlurApplied !== false}
                privacyRegionsBlurred={report.privacyRegionsBlurred}
              />
            </div>

            {/* Findings List with React Bits AnimatedList */}
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="font-bold text-sm text-white">Detected Findings</span>
                  <span className="font-mono text-xs text-slate-400">
                    {report.findings.length} objects
                  </span>
                </div>

                {report.findings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-emerald-400 font-medium">
                    Zero road surface defects detected. Street surface appears intact.
                  </div>
                ) : (
                  <AnimatedList
                    items={animatedFindingItems}
                    frame={false}
                    theme="dark"
                    width="100%"
                    maxHeight={340}
                    gap={8}
                    radius={12}
                    accentColor="#3b82f6"
                    selectOnHover={true}
                    showGradients={false}
                    animation={prefersReducedMotion ? "none" : "slide"}
                    onItemSelect={(_item, idx) => {
                      const f = report.findings[idx];
                      if (f) {
                        setSelectedFindingId(selectedFindingId === f.id ? null : f.id);
                      }
                    }}
                    renderItem={(_item, idx, isHighlighted) => {
                      const f = report.findings[idx];
                      if (!f) return null;
                      const active = selectedFindingId === f.id || isHighlighted;
                      return (
                        <div
                          onMouseEnter={() => setSelectedFindingId(f.id)}
                          className={`w-full py-1 text-xs transition ${
                            active ? "text-white" : "text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="capitalize">{f.concept}</span>
                            <span className="text-blue-400 font-mono tabular-nums">
                              {(f.confidence * 100).toFixed(0)}% conf
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                            <span>Area: {f.relativeAreaPercent}%</span>
                            <span>
                              {f.boundingBox.width}&times;{f.boundingBox.height}px
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                )}
              </div>

              {/* Urgency & Recommended Action Card */}
              <div className="bg-background/70 rounded-xl border border-border p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estimated Urgency:</span>
                  <span className="font-mono font-bold text-white">{report.estimatedUrgency}</span>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Recommended Municipal Action:</div>
                  <div className="text-slate-200 font-medium leading-relaxed">
                    {report.recommendedAction}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>
      )}
    </div>
  );
};
