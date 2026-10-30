import { useEffect, useState } from "react";

export interface MotionPreferences {
  prefersReducedMotion: boolean;
  isSmallScreen: boolean;
  allowHeavyVisuals: boolean;
}

function getInitialMatch(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

export function useMotionPreferences(): MotionPreferences {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    getInitialMatch("(prefers-reduced-motion: reduce)")
  );
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(() =>
    getInitialMatch("(max-width: 639px)")
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const screenMq = window.matchMedia("(max-width: 639px)");

    const onMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    const onScreenChange = (e: MediaQueryListEvent) => setIsSmallScreen(e.matches);

    setPrefersReducedMotion(motionMq.matches);
    setIsSmallScreen(screenMq.matches);

    motionMq.addEventListener("change", onMotionChange);
    screenMq.addEventListener("change", onScreenChange);

    return () => {
      motionMq.removeEventListener("change", onMotionChange);
      screenMq.removeEventListener("change", onScreenChange);
    };
  }, []);

  return {
    prefersReducedMotion,
    isSmallScreen,
    allowHeavyVisuals: !prefersReducedMotion && !isSmallScreen,
  };
}

