import React, { useState } from "react";
import { DamageFinding } from "@viaguard/core";
import { Eye, EyeOff, Layers, ShieldCheck, Sparkles } from "lucide-react";

interface MaskOverlayViewerProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  findings: DamageFinding[];
  selectedFindingId?: string | null;
  onSelectFinding?: (id: string | null) => void;
  title?: string;
  privacyBlurApplied?: boolean;
  privacyRegionsBlurred?: number;
}

const CONCEPT_COLORS: Record<string, { stroke: string; fill: string; chipBg: string }> = {
  pothole: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.45)", chipBg: "bg-red-500/20 text-red-400 border-red-500/30" },
  sinkhole: { stroke: "#dc2626", fill: "rgba(220, 38, 38, 0.5)", chipBg: "bg-red-600/20 text-red-300 border-red-500/30" },
  crack: { stroke: "#eab308", fill: "rgba(234, 179, 8, 0.45)", chipBg: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  patch: { stroke: "#f97316", fill: "rgba(249, 115, 22, 0.45)", chipBg: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  spall: { stroke: "#fb923c", fill: "rgba(251, 146, 60, 0.45)", chipBg: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  rut: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.45)", chipBg: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  "manhole cover": { stroke: "#94a3b8", fill: "rgba(148, 163, 184, 0.35)", chipBg: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  scaffolding: { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.45)", chipBg: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "concrete wall": { stroke: "#8b5cf6", fill: "rgba(139, 92, 246, 0.45)", chipBg: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  debris: { stroke: "#ec4899", fill: "rgba(236, 72, 153, 0.45)", chipBg: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  "steel rebar": { stroke: "#14b8a6", fill: "rgba(20, 184, 166, 0.45)", chipBg: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
};

export const MaskOverlayViewer: React.FC<MaskOverlayViewerProps> = ({
  imageUrl,
  imageWidth,
  imageHeight,
  findings,
  selectedFindingId,
  onSelectFinding,
  title,
  privacyBlurApplied = true,
  privacyRegionsBlurred,
}) => {
  const [showMasks, setShowMasks] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeId = selectedFindingId || hoveredId;

  return (
    <div className="flex flex-col bg-surface rounded-xl border border-border overflow-hidden">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-surface/90 border-b border-border gap-2 text-xs">
        <div className="flex items-center space-x-2 text-slate-200 font-medium">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>{title || "Inspection Layer Overlay"}</span>
          <span className="text-slate-400">({findings.length} findings)</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowMasks(!showMasks)}
            className={`px-2.5 py-1 rounded border flex items-center space-x-1.5 transition ${
              showMasks
                ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                : "bg-surface text-slate-400 border-border hover:text-white"
            }`}
          >
            {showMasks ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>SAM Masks</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-2.5 py-1 rounded border transition ${
              showBoxes
                ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                : "bg-surface text-slate-400 border-border hover:text-white"
            }`}
          >
            Boxes
          </button>
          <button
            type="button"
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2.5 py-1 rounded border transition ${
              showLabels
                ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                : "bg-surface text-slate-400 border-border hover:text-white"
            }`}
          >
            Labels
          </button>
        </div>
      </div>

      {/* Main Image View with SVG Overlay */}
      <div className="relative w-full overflow-hidden bg-black/40 flex items-center justify-center select-none">
        <div
          className="relative max-w-full"
          style={{
            aspectRatio: `${imageWidth} / ${imageHeight}`,
          }}
        >
          {/* Base Image */}
          <img
            src={imageUrl}
            alt={title || "Inspected road view"}
            className="w-full h-full object-contain block"
          />

          {/* SVG Overlay layer matching image dimensions */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-auto"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {findings.map((f) => {
              const colors =
                CONCEPT_COLORS[f.concept.toLowerCase()] || {
                  stroke: "#38bdf8",
                  fill: "rgba(56, 189, 248, 0.4)",
                  chipBg: "bg-sky-500/20 text-sky-400 border-sky-500/30",
                };

              const isHighlighted = activeId === f.id;
              const opacity = isHighlighted ? 0.95 : activeId ? 0.25 : 0.65;

              return (
                <g
                  key={f.id}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => {
                    setHoveredId(f.id);
                    onSelectFinding?.(f.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredId(null);
                    onSelectFinding?.(null);
                  }}
                >
                  {/* SAM 3.1 Segmentation Vector Mask (if path is available) */}
                  {showMasks && f.svgPath && (
                    <g
                      transform={
                        f.maskBounds
                          ? `translate(${f.maskBounds.left}, ${f.maskBounds.top})`
                          : undefined
                      }
                    >
                      <path
                        d={f.svgPath}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isHighlighted ? 3 : 1.5}
                        opacity={opacity}
                      />
                    </g>
                  )}

                  {/* SAM Bounding Box */}
                  {showBoxes && (
                    <rect
                      x={f.boundingBox.x1}
                      y={f.boundingBox.y1}
                      width={f.boundingBox.width}
                      height={f.boundingBox.height}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth={isHighlighted ? 3.5 : 2}
                      strokeDasharray={isHighlighted ? "none" : "6,4"}
                      opacity={isHighlighted ? 1 : 0.8}
                    />
                  )}

                  {/* Overlay Concept Badge Label */}
                  {showLabels && (
                    <g
                      transform={`translate(${f.boundingBox.x1 + 4}, ${
                        Math.max(f.boundingBox.y1 - 8, 16)
                      })`}
                    >
                      <rect
                        x="-2"
                        y="-14"
                        width={f.concept.length * 8 + 65}
                        height="20"
                        rx="4"
                        fill="#090d16"
                        stroke={colors.stroke}
                        strokeWidth="1.2"
                        opacity="0.92"
                      />
                      <text
                        x="4"
                        y="0"
                        fill="#f8fafc"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="sans-serif"
                      >
                        {f.concept} ({f.relativeAreaPercent}%)
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Footer Info Pill */}
      <div className="px-4 py-2 bg-surface/50 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Interactive segmentation powered by Meta SAM 3.1 &amp; Muse Spark</span>
        </div>
        <div className="flex items-center space-x-2.5">
          {privacyBlurApplied && (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono text-[10px] font-semibold">
              <ShieldCheck className="w-3 h-3 text-blue-400" />
              <span>
                Privacy blur: on
                {typeof privacyRegionsBlurred === "number" && privacyRegionsBlurred > 0
                  ? ` (${privacyRegionsBlurred} blurred)`
                  : ""}
              </span>
            </span>
          )}
          <span>Areas measured relative to image sensor frame</span>
        </div>
      </div>
    </div>
  );
};

