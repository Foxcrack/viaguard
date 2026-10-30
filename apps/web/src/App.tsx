import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import PillNav, { type PillNavItem } from "@/components/reactbits/PillNav";
import { HomePage } from "./pages/HomePage.tsx";
import { DemoModeProvider, useDemoMode, CachedReplayBanner } from "./context/DemoModeContext.tsx";
import { useMotionPreferences } from "./hooks/useMotionPreferences.ts";
import { VERSION } from "@viaguard/core";

const RoadPage = lazy(() =>
  import("./pages/RoadPage.tsx").then((m) => ({ default: m.RoadPage }))
);
const ConstructionPage = lazy(() =>
  import("./pages/ConstructionPage.tsx").then((m) => ({ default: m.ConstructionPage }))
);
const MapPage = lazy(() =>
  import("./pages/MapPage.tsx").then((m) => ({ default: m.MapPage }))
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage.tsx").then((m) => ({ default: m.ReportsPage }))
);
const ReportDetailPage = lazy(() =>
  import("./pages/ReportDetailPage.tsx").then((m) => ({ default: m.ReportDetailPage }))
);
import {
  Home,
  ShieldAlert,
  HardHat,
  MapPin,
  FileText,
  Sparkles,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Home", shortLabel: "Home", icon: Home },
  { to: "/road", label: "Road Damage", shortLabel: "Road", icon: ShieldAlert },
  { to: "/construction", label: "Construction", shortLabel: "Site Diff", icon: HardHat },
  { to: "/map", label: "Civic Map", shortLabel: "Map", icon: MapPin },
  { to: "/reports", label: "Reports", shortLabel: "Reports", icon: FileText },
];

function NavigationShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { demoMode, setDemoMode } = useDemoMode();
  const { prefersReducedMotion } = useMotionPreferences();

  const activeNavHref =
    NAV_ITEMS.find((item) =>
      item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
    )?.to ?? "/";

  const pillItems: PillNavItem[] = NAV_ITEMS.map((item) => {
    const Icon = item.icon;
    return {
      label: item.label,
      href: item.to,
      icon: <Icon className="w-3.5 h-3.5" />,
      ariaLabel: item.label,
    };
  });

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/90 bg-background/85 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Brand */}
          <Link to="/" className="flex items-center space-x-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-600/25 group-hover:bg-blue-500 transition">
              V
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg sm:text-xl font-black tracking-tight text-white">
                Viaguard
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                v{VERSION}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation: React Bits PillNav */}
          <div className="hidden md:flex items-center justify-center">
            <PillNav
              items={pillItems}
              activeHref={activeNavHref}
              theme="dark"
              size="sm"
              surface="glass"
              layout="joined"
              collapse="never"
              intro={!prefersReducedMotion}
              hoverEffect={prefersReducedMotion ? "none" : "glide"}
              indicator="pill"
              highlightColor="#2563eb"
              highlightTextColor="#ffffff"
              ariaLabel="Primary navigation"
              onItemClick={(item, _idx, event) => {
                event.preventDefault();
                if (item.href) {
                  navigate(item.href);
                }
              }}
            />
          </div>

          {/* Explicit Opt-In Demo Mode Switch */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={demoMode}
              onClick={() => setDemoMode(!demoMode)}
              title="Explicit opt-in Demo Mode: replays verified Meta Model API responses recorded via pnpm record:demo"
              className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-[11px] font-mono font-semibold transition flex items-center gap-1.5 ${
                demoMode
                  ? "bg-amber-500/20 text-amber-200 border-amber-500/50"
                  : "bg-surface text-slate-300 border-border hover:border-blue-500/40 hover:text-white"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  demoMode ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
              <span>{demoMode ? "Demo: ON" : "Live API"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Always-visible banner whenever opt-in Demo Mode is enabled */}
      <CachedReplayBanner active={demoMode} />

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md px-2 py-1.5"
      >
        <ul className="grid grid-cols-5 gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.to === activeNavHref;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${
                    isActive
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.shortLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function App() {
  return (
    <DemoModeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-slate-100 flex flex-col antialiased">
          <NavigationShell />

          <main className="flex-1 px-4 sm:px-6 pt-6 pb-24 md:pb-10 max-w-6xl mx-auto w-full">
            <Suspense
              fallback={
                <div className="py-20 text-center font-mono text-xs text-slate-400">
                  Loading inspection module...
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/road" element={<RoadPage />} />
                <Route path="/construction" element={<ConstructionPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/reports/:id" element={<ReportDetailPage />} />
              </Routes>
            </Suspense>
          </main>

          <footer className="border-t border-border bg-surface/40 px-6 pt-6 pb-24 md:pb-6 text-center text-xs text-slate-400">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Built for the Meta Global AI Developer Hackathon 2026</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Meta SAM 3.1 &bull; Muse Spark &bull; OpenStreetMap &bull; UI components with React Bits
              </div>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </DemoModeProvider>
  );
}
