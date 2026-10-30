import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { HomePage } from "./pages/HomePage.tsx";
import { RoadPage } from "./pages/RoadPage.tsx";
import { MapPage } from "./pages/MapPage.tsx";
import { ReportsPage } from "./pages/ReportsPage.tsx";
import { ReportDetailPage } from "./pages/ReportDetailPage.tsx";
import { ConstructionPage } from "./pages/ConstructionPage.tsx";
import { VERSION } from "@viaguard/core";
import {
  ShieldAlert,
  HardHat,
  MapPin,
  FileText,
  Sparkles,
} from "lucide-react";

function NavigationHeader() {
  const location = useLocation();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/road", label: "Road Damage", icon: ShieldAlert },
    { to: "/construction", label: "Construction", icon: HardHat },
    { to: "/map", label: "Civic Map", icon: MapPin },
    { to: "/reports", label: "Reports", icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md px-6 py-3.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition">
            V
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black tracking-tight text-white">Viaguard</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              v{VERSION}
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center space-x-1 sm:space-x-2 text-xs font-semibold">
          {navLinks.map((link) => {
            const isActive =
              link.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(link.to);
            const Icon = link.icon;

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                  isActive
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/40"
                    : "text-slate-400 hover:text-white hover:bg-surface"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-slate-100 flex flex-col antialiased">
        <NavigationHeader />

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/road" element={<RoadPage />} />
            <Route path="/construction" element={<ConstructionPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/:id" element={<ReportDetailPage />} />
          </Routes>
        </main>

        <footer className="border-t border-border bg-surface/30 px-6 py-6 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Built for the Meta Global AI Developer Hackathon 2026</span>
            </div>
            <div>Powered by Meta SAM 3.1 &bull; Muse Spark &bull; OpenStreetMap</div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
