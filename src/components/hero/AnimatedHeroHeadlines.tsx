import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedHeroHeadlinesProps {
  headlines: string[];
  className?: string;
}

export const AnimatedHeroHeadlines = ({ headlines, className = "" }: AnimatedHeroHeadlinesProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [headlines.length]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentIndex}
          initial={{ x: "-100%", opacity: 0, scale: 0.9 }}
          animate={{ x: "0%", opacity: 1, scale: 1 }}
          exit={{ x: "100%", opacity: 0, scale: 0.9 }}
          transition={{
            x: { type: "spring", stiffness: 100, damping: 20 },
            opacity: { duration: 0.4 },
            scale: { duration: 0.4 }
          }}
          className="text-primary whitespace-nowrap py-2"
        >
          {headlines[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
