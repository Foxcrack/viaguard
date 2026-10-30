import React, { Suspense, lazy } from "react";
import Stepper, { Step } from "@/components/reactbits/Stepper";
import StatusMark, { type StatusMarkStatus } from "@/components/reactbits/StatusMark";
import ThoughtLine from "@/components/reactbits/ThoughtLine";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { ProgressState } from "../api/client.ts";

const LazyScanner = lazy(() => import("@/components/reactbits/Scanner"));

interface InspectionProgressStepperProps {
  progress: ProgressState;
  mode: "road" | "construction";
}

const ROAD_STAGES = [
  { title: "Preprocess & EXIF", detail: "Validating format, extracting EXIF GPS, and resizing to 1600px" },
  { title: "Muse Spark Scene", detail: "Classifying street surface context and target concept prompts" },
  { title: "SAM 3.1 Streaming", detail: "Decoding 1-bit segmentation masks via @meta-sam/parser" },
  { title: "Severity Scoring", detail: "Computing deterministic 0–100 hazard index from active pixels" },
  { title: "Municipal Report", detail: "Authoring actionable public works directive with Muse Spark" },
];

const CONSTRUCTION_STAGES = [
  { title: "Dual Preprocess", detail: "Optimizing BEFORE and AFTER site photos and SHA-256 hashes" },
  { title: "Muse Spark Baseline", detail: "Analyzing baseline and current structural context" },
  { title: "SAM 3.1 Epoch Masks", detail: "Segmenting matching structural elements across both epochs" },
  { title: "Volumetric Diff", detail: "Computing element counts, area deltas, and progress index" },
  { title: "Progression Audit", detail: "Authoring comparative engineering report with Muse Spark" },
];

function percentToStepIndex(percent: number): number {
  if (percent < 25) return 1;
  if (percent < 50) return 2;
  if (percent < 74) return 3;
  if (percent < 88) return 4;
  return 5;
}

export const InspectionProgressStepper: React.FC<InspectionProgressStepperProps> = ({
  progress,
  mode,
}) => {
  const { prefersReducedMotion, allowHeavyVisuals } = useMotionPreferences();
  const stages = mode === "road" ? ROAD_STAGES : CONSTRUCTION_STAGES;
  const activeStep = percentToStepIndex(progress.percent);

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-surface p-5 space-y-4 shadow-xl shadow-black/40">
      {/* Top row: ThoughtLine live progress text + compact lazy Scanner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-blue-400">
            <span>Meta Model Pipeline</span>
            <span className="text-slate-600">&bull;</span>
            <span className="font-bold text-slate-200 tabular-nums">{progress.percent}%</span>
          </div>
          <ThoughtLine
            working={true}
            label={progress.step}
            shimmer={!prefersReducedMotion}
            showTimer={true}
            collapsible={false}
            color="#e2e8f0"
            glyphColor="#3b82f6"
            fontSize={14}
          />
        </div>

        {/* Contained small-area Scanner visual (lazy + static CSS fallback) */}
        <div
          className="relative h-14 w-full sm:w-40 shrink-0 rounded-xl overflow-hidden border border-blue-500/25 civic-scanner-fallback"
          aria-hidden="true"
        >
          {allowHeavyVisuals ? (
            <Suspense fallback={<div className="h-full w-full civic-scanner-fallback" />}>
              <LazyScanner
                color1="#1d4ed8"
                color2="#3b82f6"
                color3="#38bdf8"
                opacity={0.75}
                mouseInteraction={false}
                clickEffect="none"
                dpr={1}
                className="h-full w-full pointer-events-none"
              />
            </Suspense>
          ) : (
            <div className="h-full w-full civic-scanner-fallback" />
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded bg-black/65 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-blue-200">
              SAM 3.1 Scan
            </span>
          </div>
        </div>
      </div>

      {/* Deterministic progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(4, progress.percent))}%` }}
        />
      </div>

      {/* React Bits Stepper + StatusMark per step */}
      <Stepper
        step={activeStep}
        showFooter={false}
        disableStepIndicators={true}
        frame={false}
        width="100%"
        theme="dark"
        accentColor="#3b82f6"
        transition={prefersReducedMotion ? "none" : "fade"}
        renderStepIndicator={({ step, currentStep }) => {
          const markStatus: StatusMarkStatus =
            step < currentStep ? "done" : step === currentStep ? "running" : "pending";
          return (
            <StatusMark
              status={markStatus}
              color={step === currentStep ? "#3b82f6" : "#64748b"}
              doneColor="#10b981"
              size={22}
              strokeWidth={2}
            />
          );
        }}
      >
        {stages.map((s) => (
          <Step key={s.title} title={s.title} description={s.detail}>
            <div className="pt-1 text-xs text-slate-400 flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-200">{s.title}</span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">{s.detail}</span>
            </div>
          </Step>
        ))}
      </Stepper>
    </div>
  );
};

