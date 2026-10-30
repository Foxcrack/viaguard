import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
}

export const BlurText: React.FC<BlurTextProps> = ({
  text,
  delay = 0.05,
  className = "",
  animateBy = "words",
  direction = "top",
}) => {
  const prefersReducedMotion = useReducedMotion();
  const elements = animateBy === "words" ? text.split(" ") : text.split("");

  if (prefersReducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`inline-block flex-wrap ${className}`}>
      {elements.map((el, i) => (
        <motion.span
          key={i}
          initial={{
            filter: "blur(10px)",
            opacity: 0,
            y: direction === "top" ? -15 : 15,
          }}
          animate={{
            filter: "blur(0px)",
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.45,
            delay: i * delay,
            ease: [0.25, 0.25, 0, 1],
          }}
          className="inline-block mr-[0.25em] last:mr-0"
        >
          {el}
        </motion.span>
      ))}
    </span>
  );
};
