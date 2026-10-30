import React, { useMemo, useState } from "react";
import { DamageFinding } from "@viaguard/core";
import { Eye, EyeOff, Layers, ShieldCheck, Sparkles } from "lucide-react";

/** Maximum number of numbered badges shown simultaneously to prevent visual clutter. */
export const MAX_VISIBLE_BADGES = 8;

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

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PlacedBadge {
  finding: DamageFinding;
  index: number; // 0-based; display number is index + 1
  x: number;
  y: number;
  width: number;
  height: number;
}

const CONCEPT_COLORS: Record<string, { stroke: string; fill: string; chipBg: string }> = {
  pothole: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.45)", chipBg: "bg-red-500/20 text-red-400 border-red-500/30" },
  sinkhole: { stroke: "#dc2626", fill: "rgba(220, 38, 38, 0.5)", chipBg: "bg-red-600/20 text-red-300 border-red-500/30" },
  crack: { stroke: "#eab308", fill: "rgba(234, 179, 8, 0.45)", chipBg: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  patch: { stroke: "#f97316", fill: "rgba(249, 115, 22, 0.45)", chipBg: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  spall: { stroke: "#fb923c", fill: "rgba(251, 146, 60, 0.45)", chipBg: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  rut: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.45)", chipBg: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  puddle: { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.4)", chipBg: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  "manhole cover": { stroke: "#94a3b8", fill: "rgba(148, 163, 184, 0.35)", chipBg: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  scaffolding: { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.45)", chipBg: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "concrete wall": { stroke: "#8b5cf6", fill: "rgba(139, 92, 246, 0.45)", chipBg: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  debris: { stroke: "#ec4899", fill: "rgba(236, 72, 153, 0.45)", chipBg: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  "steel rebar": { stroke: "#14b8a6", fill: "rgba(20, 184, 166, 0.45)", chipBg: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
};

function getColorsForConcept(concept: string) {
  return (
    CONCEPT_COLORS[concept.toLowerCase()] || {
      stroke: "#38bdf8",
      fill: "rgba(56, 189, 248, 0.4)",
      chipBg: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    }
  );
}

function rectsOverlap(a: Rect, b: Rect, padding = 0): boolean {
  return !(
    a.x2 + padding <= b.x1 ||
    a.x1 - padding >= b.x2 ||
    a.y2 + padding <= b.y1 ||
    a.y1 - padding >= b.y2
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

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
  // Bounding boxes are optional and off by default to avoid cluttering masks
  const [showBoxes, setShowBoxes] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeId = hoveredId || selectedFindingId || null;

  const safeW = Math.max(1, imageWidth);
  const safeH = Math.max(1, imageHeight);
  // Scale SVG badge & stroke geometry proportionally to image resolution
  const u = useMemo(
    () => Math.max(0.45, Math.min(2.2, Math.max(safeW, safeH) / 850)),
    [safeW, safeH]
  );

  // Place non-overlapping numbered badges (1, 2, 3...) prioritized by highest confidence, capped at MAX_VISIBLE_BADGES
  const { placedBadges, hiddenBadgeCount } = useMemo(() => {
    const indexed = findings.map((finding, index) => ({ finding, index }));
    const byPriority = [...indexed].sort(
      (a, b) => b.finding.confidence - a.finding.confidence
    );

    const acceptedRects: Rect[] = [];
    const badges: PlacedBadge[] = [];
    const pad = 4 * u;
    const edgeMargin = 3 * u;

    for (const { finding, index } of byPriority) {
      if (badges.length >= MAX_VISIBLE_BADGES) {
        continue;
      }

      const displayNum = index + 1;
      const badgeH = 22 * u;
      const badgeW = (displayNum >= 10 ? 28 : 22) * u;

      const left = finding.maskBounds?.left ?? finding.boundingBox.x1;
      const top = finding.maskBounds?.top ?? finding.boundingBox.y1;
      const right = finding.maskBounds?.right ?? finding.boundingBox.x2;
      const bottom = finding.maskBounds?.bottom ?? finding.boundingBox.y2;
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;

      const candidateTopLefts: Array<[number, number]> = [
        [cx - badgeW / 2, cy - badgeH / 2],
        [left, top - badgeH - 3 * u],
        [right - badgeW, top - badgeH - 3 * u],
        [left, bottom + 3 * u],
        [right - badgeW, bottom + 3 * u],
        [left - badgeW - 3 * u, cy - badgeH / 2],
        [right + 3 * u, cy - badgeH / 2],
      ];

      let chosen: { x: number; y: number; rect: Rect } | null = null;
      for (const [rawX, rawY] of candidateTopLefts) {
        const x = clamp(rawX, edgeMargin, Math.max(edgeMargin, safeW - badgeW - edgeMargin));
        const y = clamp(rawY, edgeMargin, Math.max(edgeMargin, safeH - badgeH - edgeMargin));
        const candRect: Rect = { x1: x, y1: y, x2: x + badgeW, y2: y + badgeH };
        const collides = acceptedRects.some((r) => rectsOverlap(candRect, r, pad));
        if (!collides) {
          chosen = { x, y, rect: candRect };
          break;
        }
      }

      if (chosen) {
        acceptedRects.push(chosen.rect);
        badges.push({
          finding,
          index,
          x: chosen.x,
          y: chosen.y,
          width: badgeW,
          height: badgeH,
        });
      }
    }

    // Sort back by display index for clean DOM order
    badges.sort((a, b) => a.index - b.index);
    return {
      placedBadges: badges,
      hiddenBadgeCount: Math.max(0, findings.length - badges.length),
    };
  }, [findings, safeW, safeH, u]);

  // Compute expanded full-label callout ONLY for the currently hovered or selected finding
  const activeCallout = useMemo(() => {
    if (!activeId) return null;
    const index = findings.findIndex((f) => f.id === activeId);
    if (index === -1) return null;
    const finding = findings[index];
    const displayNum = index + 1;
    const labelText = `#${displayNum} ${finding.concept} · ${finding.relativeAreaPercent}% · ${(
      finding.confidence * 100
    ).toFixed(0)}%`;

    const height = 24 * u;
    const width = Math.min(
      safeW - 8 * u,
      (labelText.length * 6.6 + 18) * u
    );

    const left = finding.maskBounds?.left ?? finding.boundingBox.x1;
    const top = finding.maskBounds?.top ?? finding.boundingBox.y1;
    const bottom = finding.maskBounds?.bottom ?? finding.boundingBox.y2;

    const edgeMargin = 4 * u;
    const x = clamp(left, edgeMargin, Math.max(edgeMargin, safeW - width - edgeMargin));
    const preferAbove = top - height - 6 * u;
    const y =
      preferAbove >= edgeMargin
        ? preferAbove
        : clamp(bottom + 6 * u, edgeMargin, Math.max(edgeMargin, safeH - height - edgeMargin));

    return {
      finding,
      index,
      labelText,
      x,
      y,
      width,
      height,
      rect: { x1: x, y1: y, x2: x + width, y2: y + height } as Rect,
    };
  }, [activeId, findings, safeW, safeH, u]);

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
            Badges
          </button>
        </div>
      </div>

      {/* Main Image View with SVG Overlay */}
      <div className="relative w-full overflow-hidden bg-black/40 flex items-center justify-center select-none">
        <div
          className="relative max-w-full"
          style={{
            aspectRatio: `${safeW} / ${safeH}`,
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
            viewBox={`0 0 ${safeW} ${safeH}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Layer 1: Segmentation Masks & Optional Bounding Boxes */}
            {findings.map((f) => {
              const colors = getColorsForConcept(f.concept);
              const isHighlighted = activeId === f.id;
              const opacity = isHighlighted ? 0.92 : activeId ? 0.25 : 0.62;

              return (
                <g
                  key={f.id}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => setHoveredId(f.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() =>
                    onSelectFinding?.(selectedFindingId === f.id ? null : f.id)
                  }
                >
                  {/* SAM 3.1 Segmentation Vector Mask */}
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
                        strokeWidth={(isHighlighted ? 3 : 1.6) * u}
                        opacity={opacity}
                      />
                    </g>
                  )}

                  {/* Optional SAM Bounding Box */}
                  {showBoxes && (
                    <rect
                      x={f.boundingBox.x1}
                      y={f.boundingBox.y1}
                      width={f.boundingBox.width}
                      height={f.boundingBox.height}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth={(isHighlighted ? 3 : 1.8) * u}
                      strokeDasharray={isHighlighted ? "none" : `${6 * u},${4 * u}`}
                      opacity={isHighlighted ? 1 : 0.8}
                    />
                  )}
                </g>
              );
            })}

            {/* Layer 2: Non-Overlapping Numbered Badges (1, 2, 3...) */}
            {showLabels &&
              placedBadges.map((b) => {
                // When this finding is hovered/selected, render the expanded full label instead
                if (activeCallout && activeCallout.finding.id === b.finding.id) {
                  return null;
                }
                // Hide any default badge that would collide with the active full-label callout
                if (
                  activeCallout &&
                  rectsOverlap(
                    { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height },
                    activeCallout.rect,
                    2 * u
                  )
                ) {
                  return null;
                }

                const colors = getColorsForConcept(b.finding.concept);
                const dimmed = Boolean(activeId && activeId !== b.finding.id);

                return (
                  <g
                    key={`badge-${b.finding.id}`}
                    transform={`translate(${b.x}, ${b.y})`}
                    className="cursor-pointer"
                    opacity={dimmed ? 0.45 : 0.96}
                    onMouseEnter={() => setHoveredId(b.finding.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() =>
                      onSelectFinding?.(
                        selectedFindingId === b.finding.id ? null : b.finding.id
                      )
                    }
                  >
                    <rect
                      x={0}
                      y={0}
                      width={b.width}
                      height={b.height}
                      rx={b.height / 2}
                      fill="#090d16"
                      stroke={colors.stroke}
                      strokeWidth={1.8 * u}
                    />
                    <text
                      x={b.width / 2}
                      y={b.height / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#f8fafc"
                      fontSize={11.5 * u}
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace, sans-serif"
                    >
                      {b.index + 1}
                    </text>
                  </g>
                );
              })}

            {/* Layer 3: Full Label Callout (shown ONLY on hover or when selected) */}
            {activeCallout && (
              <g
                transform={`translate(${activeCallout.x}, ${activeCallout.y})`}
                className="pointer-events-none"
              >
                <rect
                  x={0}
                  y={0}
                  width={activeCallout.width}
                  height={activeCallout.height}
                  rx={6 * u}
                  fill="#090d16"
                  stroke={getColorsForConcept(activeCallout.finding.concept).stroke}
                  strokeWidth={2 * u}
                  opacity={0.96}
                />
                <text
                  x={8 * u}
                  y={activeCallout.height / 2}
                  dominantBaseline="central"
                  fill="#f8fafc"
                  fontSize={11 * u}
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {activeCallout.labelText}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Footer Info Pill */}
      <div className="px-4 py-2 bg-surface/50 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>
            Hover or click badge/item to inspect full label
            {showLabels && hiddenBadgeCount > 0
              ? ` (${hiddenBadgeCount} low-conf badge${hiddenBadgeCount > 1 ? "s" : ""} hidden to avoid overlap)`
              : ""}
          </span>
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
