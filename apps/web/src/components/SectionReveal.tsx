import React from "react";
import FadeContent from "@/components/reactbits/FadeContent";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";

interface SectionRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const SectionReveal: React.FC<SectionRevealProps> = ({
  children,
  className = "",
  delay = 0,
}) => {
  const { prefersReducedMotion } = useMotionPreferences();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <FadeContent
      className={className}
      duration={0.55}
      delay={delay}
      threshold={0.08}
      blur={false}
      once={true}
    >
      {children}
    </FadeContent>
  );
};

