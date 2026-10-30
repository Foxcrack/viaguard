import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { VERSION } from "@viaguard/core";

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-slate-100 flex flex-col">
        <header className="border-b border-border bg-surface/50 backdrop-blur px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl font-bold tracking-tight text-white">Viaguard</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">v{VERSION}</span>
          </div>
          <nav className="flex space-x-6 text-sm">
            <Link to="/" className="text-slate-300 hover:text-white transition">Home</Link>
          </nav>
        </header>
        <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
          <Routes>
            <Route
              path="/"
              element={
                <div className="py-12 text-center">
                  <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                    Civic Infrastructure Intelligence
                  </h1>
                  <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
                    Turn phone photos of roads and construction sites into actionable inspection reports for city authorities. Powered by Meta's SAM 3.1 & Muse Spark.
                  </p>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
