import React, { useState, useRef, useCallback } from "react";
import { DamageFinding } from "@viaguard/core";

interface BeforeAfterSliderProps {
  beforeImageUrl: string;
  afterImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  beforeFindings?: DamageFinding[];
  afterFindings?: DamageFinding[];
  showOverlays?: boolean;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImageUrl,
  afterImageUrl,
  imageWidth,
  imageHeight,
  beforeFindings = [],
  afterFindings = [],
  showOverlays = true,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      className="relative w-full rounded-xl overflow-hidden border border-border select-none bg-black/60 cursor-ew-resize"
      style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
    >
      {/* AFTER Image (Full background) */}
      <div className="absolute inset-0 w-full h-full">
        <img
          src={afterImageUrl}
          alt="Site After"
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* AFTER Overlays */}
        {showOverlays && afterFindings.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {afterFindings.map((f) => (
              <g key={`after-${f.id}`}>
                {f.svgPath && (
                  <path
                    d={f.svgPath}
                    transform={
                      f.maskBounds
                        ? `translate(${f.maskBounds.left}, ${f.maskBounds.top})`
                        : undefined
                    }
                    fill="rgba(59, 130, 246, 0.45)"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                )}
                <rect
                  x={f.boundingBox.x1}
                  y={f.boundingBox.y1}
                  width={f.boundingBox.width}
                  height={f.boundingBox.height}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />
              </g>
            ))}
          </svg>
        )}

        <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/70 text-emerald-400 border border-emerald-500/30 backdrop-blur pointer-events-none">
          AFTER (CURRENT)
        </span>
      </div>

      {/* BEFORE Image (Clipped overlay) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <div
          className="relative h-full"
          style={{
            width: containerRef.current ? `${containerRef.current.clientWidth}px` : "100%",
          }}
        >
          <img
            src={beforeImageUrl}
            alt="Site Before"
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* BEFORE Overlays */}
          {showOverlays && beforeFindings.length > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imageWidth} ${imageHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {beforeFindings.map((f) => (
                <g key={`before-${f.id}`}>
                  {f.svgPath && (
                    <path
                      d={f.svgPath}
                      transform={
                        f.maskBounds
                          ? `translate(${f.maskBounds.left}, ${f.maskBounds.top})`
                          : undefined
                      }
                      fill="rgba(245, 158, 11, 0.45)"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  )}
                  <rect
                    x={f.boundingBox.x1}
                    y={f.boundingBox.y1}
                    width={f.boundingBox.width}
                    height={f.boundingBox.height}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                  />
                </g>
              ))}
            </svg>
          )}

          <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/70 text-amber-400 border border-amber-500/30 backdrop-blur pointer-events-none">
            BEFORE (BASELINE)
          </span>
        </div>
      </div>

      {/* Draggable Divider Line & Handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)] pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-xl border-2 border-slate-900 pointer-events-none font-bold text-xs">
          ↔
        </div>
      </div>
    </div>
  );
};
