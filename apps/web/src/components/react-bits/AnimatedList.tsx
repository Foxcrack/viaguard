import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface AnimatedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string | number;
  className?: string;
}

export function AnimatedList<T>({
  items,
  renderItem,
  getKey,
  className = "",
}: AnimatedListProps<T>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={getKey(item, index)}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
