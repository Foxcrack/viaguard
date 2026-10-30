import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client.ts";

interface DemoModeContextValue {
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  demoMode: false,
  setDemoMode: () => {},
});

export const DemoModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [demoMode, setDemoMode] = useState<boolean>(false);

  useEffect(() => {
    api
      .getHealth()
      .then((health) => {
        // Only activate if user explicitly configured DEMO_MODE=true in environment
        if (health?.demoModeDefault === true) {
          setDemoMode(true);
        }
      })
      .catch(() => {
        // Never activate demo mode silently on network or health errors
      });
  }, []);

  return (
    <DemoModeContext.Provider value={{ demoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
};

export function useDemoMode(): DemoModeContextValue {
  return useContext(DemoModeContext);
}

export const CachedReplayBanner: React.FC<{ active: boolean; compact?: boolean }> = ({
  active,
  compact = false,
}) => {
  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border border-amber-500/40 bg-amber-500/15 text-amber-200 ${
        compact ? "rounded-lg px-4 py-2.5 text-xs" : "border-x-0 border-t-0 px-6 py-2.5 text-xs"
      }`}
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-amber-100 font-bold">Replaying cached real responses</span>
          <span className="text-amber-200/80 font-normal hidden sm:inline">
            &mdash; Opt-in Demo Mode active (only verified Meta Model API responses recorded via{" "}
            <code className="font-mono text-[11px] bg-black/30 px-1.5 py-0.5 rounded">
              pnpm record:demo
            </code>{" "}
            are used).
          </span>
        </div>
      </div>
    </div>
  );
};

