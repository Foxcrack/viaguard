import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api, DemoSample, ProgressState } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import { MaskOverlayViewer } from "../components/MaskOverlayViewer.tsx";
import { InspectionMap } from "../components/InspectionMap.tsx";
import { AnimatedList } from "../components/react-bits/AnimatedList.tsx";
import { useDemoMode, CachedReplayBanner } from "../context/DemoModeContext.tsx";
import {
  UploadCloud,
  MapPin,
  Compass,
  FileCheck2,
  Printer,
  RotateCcw,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export const RoadPage: React.FC = () => {
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
  const { demoMode } = useDemoMode();

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
      alert("Browser geolocation is not supported on this device.");
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
        alert(`Geolocation error: ${err.message}. You can manually click on the map to place a pin.`);
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
        demoMode
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

  return (
    <div className="space-y-8 py-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Road Damage Inspection
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Detect, measure, and geolocate potholes, alligator cracks, and roadbed deterioration using Meta SAM 3.1 &amp; Muse Spark.
          </p>
        </div>
        {report && (
          <button
            onClick={handleReset}
            className="self-start md:self-auto px-4 py-2 rounded-lg bg-surface hover:bg-surface/90 border border-border text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Audit Another Street</span>
          </button>
        )}
      </div>

      {/* Main Flow: Upload vs Analysis Results */}
      {!report ? (
        <div className="grid md:grid-cols-3 gap-8">
          {/* Left Column: Image Upload & Preview */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">Upload Road Photo</span>
                <span className="text-xs text-slate-500">Max 10 MB &bull; JPEG, PNG, WebP</span>
              </div>

              {previewUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border bg-black/40">
                  <img
                    src={previewUrl}
                    alt="Inspection preview"
                    className="w-full h-72 object-contain block"
                  />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute top-3 right-3 px-2.5 py-1 rounded bg-black/70 hover:bg-black/90 text-slate-300 hover:text-white text-xs font-medium backdrop-blur transition"
                  >
                    Change Image
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-border hover:border-blue-500/60 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-surface/40 hover:bg-blue-500/5 group">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="mt-3 font-medium text-sm text-slate-200">
                    Click to upload or drag photo here
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    EXIF GPS coordinates are read automatically
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}

              {/* Privacy Blur Toggle */}
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center space-x-2 cursor-pointer">
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
                <span className="text-[11px] text-emerald-400 font-semibold">Enabled</span>
              </div>

              {/* Sample Images Quick Selector */}
              <div className="pt-2">
                <div className="text-xs text-slate-400 mb-2 font-medium">Or test with verified demo samples:</div>
                <div className="flex flex-wrap gap-2">
                  {samples.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSampleSelect(sample)}
                      className="px-3 py-1.5 rounded-lg bg-surface/80 hover:bg-slate-800 border border-border text-xs text-slate-300 hover:text-white transition flex items-center space-x-1.5"
                    >
                      <span>📸</span>
                      <span>{sample.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Inspection Failed</div>
                  <div className="text-xs mt-0.5">{error}</div>
                </div>
              </div>
            )}

            {/* Progress Stepper View */}
            {analyzing && progress && (
              <div className="bg-surface rounded-xl border border-blue-500/40 p-6 space-y-4 shadow-xl shadow-blue-500/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-400 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Meta Model Pipeline Running</span>
                  </span>
                  <span className="font-bold text-slate-200">{progress.percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  {progress.step}
                </div>
                <div className="text-[11px] text-slate-500">
                  Calling SAM 3.1 1-bit streaming segmentation &bull; Muse Spark reasoning
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Geolocation & Action Button */}
          <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white flex items-center space-x-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Geographic Pin</span>
                </span>
                {location && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {location.source}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                If your phone photo includes EXIF GPS, coordinates will be populated automatically upon upload. Alternatively, choose your location below:
              </p>

              <button
                type="button"
                onClick={handleUseBrowserLocation}
                className="w-full py-2 px-3 rounded-lg bg-surface/80 hover:bg-slate-800 border border-border text-xs text-slate-200 font-medium transition flex items-center justify-center space-x-1.5"
              >
                <Compass className="w-4 h-4 text-blue-400" />
                <span>Use Current Device Location</span>
              </button>

              <div className="h-44 rounded-lg overflow-hidden border border-border">
                <InspectionMap
                  reports={[]}
                  interactiveSelect={true}
                  selectedLocation={location}
                  onLocationSelect={(loc) => setLocation({ ...loc, source: "manual" })}
                  className="h-full w-full"
                />
              </div>

              {location && (
                <div className="text-[11px] text-slate-400 font-mono text-center">
                  Latitude: {location.latitude} &bull; Longitude: {location.longitude}
                </div>
              )}
            </div>

            {/* Launch Button */}
            <button
              type="button"
              disabled={!selectedFile || analyzing}
              onClick={handleStartAnalysis}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition flex items-center justify-center space-x-2 shadow-lg ${
                !selectedFile || analyzing
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-border"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25"
              }`}
            >
              <FileCheck2 className="w-5 h-5" />
              <span>{analyzing ? "Running Inspection..." : "Run Inspection Audit"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Results View */
        <div className="space-y-8">
          <CachedReplayBanner active={Boolean(report.isCached) && !demoMode} compact />
          {/* Top Banner: Severity & Urgency */}
          <div
            className={`p-6 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              report.severityLevel === "critical"
                ? "bg-red-500/10 border-red-500/30"
                : report.severityLevel === "high"
                ? "bg-orange-500/10 border-orange-500/30"
                : report.severityLevel === "medium"
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-emerald-500/10 border-emerald-500/30"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                    report.severityLevel === "critical"
                      ? "bg-red-500 text-white"
                      : report.severityLevel === "high"
                      ? "bg-orange-500 text-white"
                      : report.severityLevel === "medium"
                      ? "bg-amber-500 text-slate-900"
                      : "bg-emerald-500 text-white"
                  }`}
                >
                  {report.severityLevel} SEVERITY ({report.severityScore}/100)
                </span>
                <span className="text-xs text-slate-400">
                  Report ID: <strong>{report.id}</strong>
                </span>
              </div>
              <h2 className="text-2xl font-black text-white">{report.title}</h2>
              <p className="text-xs text-slate-300 max-w-2xl">{report.summary}</p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <a
                href={`/api/reports/${report.id}/export`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-lg bg-surface hover:bg-surface/90 border border-border text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <Printer className="w-4 h-4 text-blue-400" />
                <span>Export PDF / Print</span>
              </a>
              <Link
                to="/map"
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <MapPin className="w-4 h-4" />
                <span>Locate on Map</span>
              </Link>
            </div>
          </div>

          {/* Inspection Overlay & Findings Breakdown */}
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
              />
            </div>

            {/* Findings List */}
            <div className="bg-surface rounded-xl border border-border p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="font-bold text-sm text-white">Detected Findings</span>
                  <span className="text-xs text-slate-400">{report.findings.length} objects</span>
                </div>

                {report.findings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Zero road surface defects detected. Street surface appears pristine.
                  </div>
                ) : (
                  <AnimatedList
                    items={report.findings}
                    getKey={(f) => f.id}
                    className="space-y-2 max-h-[350px] overflow-y-auto pr-1"
                    renderItem={(f) => {
                      const isSelected = selectedFindingId === f.id;
                      return (
                        <div
                          onClick={() => setSelectedFindingId(isSelected ? null : f.id)}
                          onMouseEnter={() => setSelectedFindingId(f.id)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                            isSelected
                              ? "bg-blue-500/20 border-blue-500 text-white"
                              : "bg-surface/60 border-border/70 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="capitalize">{f.concept}</span>
                            <span className="text-blue-400 font-mono">
                              {(f.confidence * 100).toFixed(0)}% conf
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                            <span>Relative Area: {f.relativeAreaPercent}%</span>
                            <span className="font-mono text-[10px]">
                              w={f.boundingBox.width} h={f.boundingBox.height}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                )}
              </div>

              {/* Urgency & Recommended Action Card */}
              <div className="bg-surface/80 rounded-lg border border-border/80 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estimated Urgency:</span>
                  <span className="font-bold text-white">{report.estimatedUrgency}</span>
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
        </div>
      )}
    </div>
  );
};
