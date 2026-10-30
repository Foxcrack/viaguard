import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BlurText from "@/components/reactbits/BlurText";
import ShinyText from "@/components/reactbits/ShinyText";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GlareHover from "@/components/reactbits/GlareHover";
import Magnet from "@/components/reactbits/Magnet";
import StarBorder from "@/components/reactbits/StarBorder";
import ClickSpark from "@/components/reactbits/ClickSpark";
import CountUp from "@/components/reactbits/CountUp";
import MagicBento, { type MagicBentoItem } from "@/components/reactbits/MagicBento";
import { SectionReveal } from "@/components/SectionReveal";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { api } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import {
  ShieldAlert,
  ArrowRight,
  HardHat,
  MapPin,
  FileText,
  Activity,
  Layers,
  Lock,
  Sparkles,
  Cpu,
  Ruler,
} from "lucide-react";

// Heavy WebGL/canvas layers are lazy-loaded and disabled on mobile / prefers-reduced-motion
const LazyTopography = lazy(() => import("@/components/reactbits/Topography"));
const LazyNoise = lazy(() => import("@/components/reactbits/Noise"));

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { prefersReducedMotion, isSmallScreen, allowHeavyVisuals } = useMotionPreferences();
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getReports()
      .then((data) => setReports(data))
      .catch((err) => console.error("Error loading reports:", err))
      .finally(() => setLoading(false));
  }, []);

  const highCriticalCount = useMemo(
    () =>
      reports.filter(
        (r) => r.severityLevel === "high" || r.severityLevel === "critical"
      ).length,
    [reports]
  );

  const averageSeverity = useMemo(() => {
    if (reports.length === 0) return 0;
    const sum = reports.reduce((acc, r) => acc + r.severityScore, 0);
    return Math.round(sum / reports.length);
  }, [reports]);

  const featureBentoItems: MagicBentoItem[] = useMemo(
    () => [
      {
        id: "sam-streaming",
        label: "Meta SAM 3.1",
        title: "1-Bit Streaming Mask Segmentation",
        description:
          "Decodes streaming token masks via @meta-sam/parser into binary rasters for exact relative area percentages and crisp SVG overlays.",
        icon: <Layers className="w-5 h-5 text-blue-400" />,
        visual: "analytics",
        colSpan: isSmallScreen ? 1 : 2,
      },
      {
        id: "muse-spark",
        label: "Meta Muse Spark",
        title: "Structured Engineering Reasoning",
        description:
          "Classifies street surfaces, selects targeted SAM concept prompts, and authors municipal work orders.",
        icon: <Cpu className="w-5 h-5 text-blue-400" />,
        visual: "automation",
      },
      {
        id: "deterministic-scoring",
        label: "0–100 Index",
        title: "Deterministic Hazard Formula",
        description:
          "Severity scores are computed mathematically from active pixel ratios, object counts, confidence, and hazard weights—never hallucinated.",
        icon: <Ruler className="w-5 h-5 text-blue-400" />,
        visual: "dashboard",
      },
      {
        id: "geospatial-exif",
        label: "EXIF + OpenStreetMap",
        title: "Automatic GPS Pinning",
        description:
          "Reads camera EXIF GPS coordinates before resizing and plots severity-coded markers on an interactive municipal map.",
        icon: <MapPin className="w-5 h-5 text-blue-400" />,
        visual: "integration",
      },
      {
        id: "privacy-blur",
        label: "Civic Compliance",
        title: "Privacy-by-Design Redaction",
        description:
          "Segments pedestrians and vehicle license plates and applies 25px Gaussian blur prior to persistence.",
        icon: <Lock className="w-5 h-5 text-blue-400" />,
        visual: "security",
      },
    ],
    [isSmallScreen]
  );

  return (
    <div className="relative space-y-14 py-4">
      {/* Subtle film grain overlay on Home page ONLY (desktop + motion allowed) */}
      {allowHeavyVisuals && (
        <Suspense fallback={null}>
          <LazyNoise
            opacity={0.025}
            fps={0}
            fixed={true}
            zIndex={30}
            dust={0}
            scratches={0}
            flicker={0}
            className="pointer-events-none"
          />
        </Suspense>
      )}

      {/* Hero Section with lazy Topography background & static CSS gradient fallback */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-border civic-hero-gradient px-6 py-14 sm:px-12 sm:py-20 shadow-2xl shadow-black/50">
        {allowHeavyVisuals && (
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <Suspense fallback={<div className="h-full w-full civic-hero-gradient" />}>
              <LazyTopography
                color="#3b82f6"
                lineCount={15}
                lineWidth={1.1}
                speed={0.28}
                opacity={0.38}
                glow={0.25}
                mouseInteraction={false}
                clickEffect="none"
                intro={false}
                dpr={1}
                className="h-full w-full pointer-events-none"
              />
            </Suspense>
          </div>
        )}

        {/* High-contrast readability scrim */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#070a12]/70 via-[#070a12]/80 to-[#070a12]/95"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-3xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <ShinyText
              text="Meta Global AI Developer Hackathon 2026 · Build for Your World"
              color="#bfdbfe"
              shineColor="#ffffff"
              speed={3}
              disabled={prefersReducedMotion}
            />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
            {prefersReducedMotion ? (
              "Turn Phone Photos Into Actionable Civic Reports"
            ) : (
              <BlurText
                text="Turn Phone Photos Into Actionable Civic Reports"
                animateBy="words"
                direction="top"
                delay={65}
                className="justify-center text-white"
              />
            )}
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed">
            Turn any smartphone photo of a street or a construction site into a measured,
            geolocated, prioritized inspection work order using{" "}
            <strong className="font-semibold text-white">Meta SAM 3.1</strong> and{" "}
            <strong className="font-semibold text-white">Muse Spark</strong>.
          </p>

          {/* Primary CTA (StarBorder + Magnet + ClickSpark) + clean secondary actions */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            <ClickSpark sparkColor="#60a5fa" sparkSize={8} sparkCount={8} disabled={prefersReducedMotion}>
              <Magnet padding={44} magnetStrength={3} disabled={prefersReducedMotion || isSmallScreen}>
                <StarBorder
                  type="button"
                  onClick={() => navigate("/road")}
                  color="#3b82f6"
                  trailColor="#93c5fd"
                  backgroundColor="#1d4ed8"
                  textColor="#ffffff"
                  radius={12}
                  duration={5}
                  sparkle={!prefersReducedMotion}
                  className="font-semibold text-sm cursor-pointer shadow-lg shadow-blue-600/30"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Inspect Road Damage</span>
                  <ArrowRight className="w-4 h-4" />
                </StarBorder>
              </Magnet>
            </ClickSpark>

            <Link
              to="/construction"
              className="min-h-[46px] px-5 py-3 rounded-xl bg-surface/90 hover:bg-slate-800 text-slate-100 border border-border hover:border-blue-500/40 font-semibold text-sm transition inline-flex items-center gap-2"
            >
              <HardHat className="w-4 h-4 text-blue-400" />
              <span>Compare Site Progress</span>
            </Link>

            <Link
              to="/map"
              className="min-h-[46px] px-5 py-3 rounded-xl bg-surface/90 hover:bg-slate-800 text-slate-100 border border-border hover:border-blue-500/40 font-semibold text-sm transition inline-flex items-center gap-2"
            >
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>Open Civic Map</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Live Metrics Row (CountUp) */}
      <SectionReveal>
        <section
          aria-label="Inspection summary statistics"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="font-mono text-3xl font-extrabold text-white tabular-nums">
              <CountUp to={reports.length} duration={1.1} />
            </div>
            <div className="mt-1 text-xs font-medium text-slate-400">
              Total Inspection Reports
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div
              className={`font-mono text-3xl font-extrabold tabular-nums ${
                highCriticalCount > 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              <CountUp to={highCriticalCount} duration={1.1} />
            </div>
            <div className="mt-1 text-xs font-medium text-slate-400">
              High &amp; Critical Hazards
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="font-mono text-3xl font-extrabold text-white tabular-nums">
              <CountUp to={averageSeverity} suffix="/100" duration={1.1} />
            </div>
            <div className="mt-1 text-xs font-medium text-slate-400">
              Average Severity Index
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="font-mono text-xl sm:text-2xl font-extrabold text-blue-400 tracking-tight">
              SAM 3.1 + Muse
            </div>
            <div className="mt-2 text-xs font-medium text-slate-400">
              Meta Model API Pipeline
            </div>
          </div>
        </section>
      </SectionReveal>

      {/* Module Cards (SpotlightCard + GlareHover) */}
      <SectionReveal>
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
                Core Inspection Modules
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Two Workflows &bull; One Deterministic Pipeline
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Shared Meta SAM 3.1 raster decoding, objective scoring math, and printable city work orders.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Module 1: Road Damage */}
            <GlareHover
              width="100%"
              height="100%"
              background="transparent"
              borderRadius="24px"
              borderColor="rgba(59, 130, 246, 0.22)"
              glareColor="#60a5fa"
              glareOpacity={prefersReducedMotion ? 0 : 0.16}
              variant="sheen"
              className="w-full"
            >
              <SpotlightCard
                theme="dark"
                spotlightColor="rgba(59, 130, 246, 0.24)"
                intensity={prefersReducedMotion ? 0 : 0.2}
                borderGlow={prefersReducedMotion ? 0 : 0.65}
                className="w-full h-full flex flex-col justify-between !bg-[#0f1624] border border-border"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/25">
                      Primary Module
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white">1. Road Damage Assessment</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Upload any street photo to segment potholes, alligator cracks, and roadbed voids. Reads EXIF GPS tags automatically and pins prioritized hazards onto the municipal map.
                  </p>

                  <ul className="text-xs text-slate-400 space-y-2 pt-1">
                    <li className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Deterministic 0–100 hazard index from active mask pixels</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Interactive SAM 3.1 vector mask &amp; bounding-box inspector</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  <ClickSpark sparkColor="#60a5fa" disabled={prefersReducedMotion}>
                    <Magnet padding={32} magnetStrength={2.5} disabled={prefersReducedMotion || isSmallScreen}>
                      <Link
                        to="/road"
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition inline-flex items-center gap-2 shadow-md shadow-blue-600/25"
                      >
                        <span>Open Road Inspector</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Magnet>
                  </ClickSpark>
                </div>
              </SpotlightCard>
            </GlareHover>

            {/* Module 2: Construction Progress */}
            <GlareHover
              width="100%"
              height="100%"
              background="transparent"
              borderRadius="24px"
              borderColor="rgba(59, 130, 246, 0.22)"
              glareColor="#60a5fa"
              glareOpacity={prefersReducedMotion ? 0 : 0.16}
              variant="sheen"
              className="w-full"
            >
              <SpotlightCard
                theme="dark"
                spotlightColor="rgba(59, 130, 246, 0.24)"
                intensity={prefersReducedMotion ? 0 : 0.2}
                borderGlow={prefersReducedMotion ? 0 : 0.65}
                className="w-full h-full flex flex-col justify-between !bg-[#0f1624] border border-border"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <HardHat className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-border">
                      Before / After Diff
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white">2. Construction Progress</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Upload BEFORE and AFTER photos of the same site. Measures newly erected concrete walls, scaffolding, and rebar while flagging surface deterioration or debris buildup.
                  </p>

                  <ul className="text-xs text-slate-400 space-y-2 pt-1">
                    <li className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Quantitative element delta table &amp; -100 to +100 progress index</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Touch-ready Before/After comparison slider with SAM masks</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  <ClickSpark sparkColor="#60a5fa" disabled={prefersReducedMotion}>
                    <Magnet padding={32} magnetStrength={2.5} disabled={prefersReducedMotion || isSmallScreen}>
                      <Link
                        to="/construction"
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-border hover:border-blue-500/40 font-semibold text-sm transition inline-flex items-center gap-2"
                      >
                        <span>Open Construction Diff</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Magnet>
                  </ClickSpark>
                </div>
              </SpotlightCard>
            </GlareHover>
          </div>
        </section>
      </SectionReveal>

      {/* Feature Grid (React Bits MagicBento) */}
      <SectionReveal>
        <section className="space-y-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
              Platform Capabilities
            </span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Engineered for Municipal Public Works
            </h2>
          </div>

          <MagicBento
            items={featureBentoItems}
            columns={isSmallScreen ? 1 : 3}
            rowHeight={195}
            gap={14}
            radius={18}
            theme="dark"
            glowColor="59, 130, 246"
            enableBorderGlow={!prefersReducedMotion}
            enableSpotlight={!prefersReducedMotion}
            enableStars={false}
            enableTilt={false}
            enableMagnetism={false}
            clickEffect={!prefersReducedMotion}
            intro={!prefersReducedMotion}
            disableAnimations={prefersReducedMotion}
          />
        </section>
      </SectionReveal>

      {/* Recent Inspection Reports Preview */}
      <SectionReveal>
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Recent Municipal Audits</h2>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
            >
              <span>View Archive</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm rounded-2xl border border-border bg-surface">
              Loading inspection archive...
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm bg-surface rounded-2xl border border-border">
              No inspection reports recorded yet. Upload a photo in the{" "}
              <Link to="/road" className="text-blue-400 hover:underline font-medium">
                Road Damage
              </Link>{" "}
              or{" "}
              <Link to="/construction" className="text-blue-400 hover:underline font-medium">
                Construction
              </Link>{" "}
              module to generate your first municipal audit.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {reports.slice(0, 4).map((report) => (
                <Link
                  key={report.id}
                  to={`/reports/${report.id}`}
                  className="group bg-surface rounded-2xl border border-border p-3.5 hover:border-blue-500/40 transition flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {report.imageUrl && (
                      <img
                        src={report.imageUrl}
                        alt={report.title}
                        loading="lazy"
                        className="w-full h-28 object-cover rounded-xl border border-border/60"
                      />
                    )}
                    <div className="font-semibold text-xs text-white line-clamp-1">
                      {report.title}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold uppercase ${
                          report.severityLevel === "critical" || report.severityLevel === "high"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : report.severityLevel === "medium"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {report.severityLevel} ({report.severityScore})
                      </span>
                      <span className="text-slate-400 capitalize">{report.module}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </SectionReveal>
    </div>
  );
};
