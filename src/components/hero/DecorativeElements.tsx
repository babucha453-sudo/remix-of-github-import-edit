import { motion } from "framer-motion";

interface FloatingShapeProps {
  className?: string;
  delay?: number;
}

export const FloatingDot = ({ className = "", delay = 0 }: FloatingShapeProps) => (
  <motion.div
    className={`absolute rounded-full ${className}`}
    animate={{ 
      scale: [1, 1.5, 1], 
      opacity: [0.4, 0.8, 0.4] 
    }}
    transition={{ 
      duration: 2.5, 
      repeat: Infinity, 
      delay 
    }}
  />
);

export const FloatingCircle = ({ className = "", delay = 0 }: FloatingShapeProps) => (
  <motion.div
    className={`absolute rounded-full border ${className}`}
    animate={{ 
      scale: [1, 1.15, 1], 
      opacity: [0.1, 0.25, 0.1],
      rotate: [0, 90, 0]
    }}
    transition={{ 
      duration: 8, 
      repeat: Infinity, 
      ease: "easeInOut",
      delay 
    }}
  />
);

export const FloatingCross = ({ className = "", delay = 0 }: FloatingShapeProps) => (
  <motion.div
    className={`absolute font-bold select-none ${className}`}
    animate={{ 
      y: [-8, 8, -8], 
      opacity: [0.15, 0.35, 0.15],
      rotate: [0, 10, 0]
    }}
    transition={{ 
      duration: 5, 
      repeat: Infinity, 
      ease: "easeInOut",
      delay 
    }}
  >
    +
  </motion.div>
);

export const GradientOrb = ({ className = "", delay = 0 }: FloatingShapeProps) => (
  <motion.div
    className={`absolute rounded-full blur-3xl ${className}`}
    animate={{ 
      scale: [1, 1.2, 1], 
      opacity: [0.3, 0.5, 0.3],
      x: [0, 15, 0],
      y: [0, -10, 0],
    }}
    transition={{ 
      duration: 10, 
      repeat: Infinity, 
      ease: "easeInOut",
      delay 
    }}
  />
);

export const ToothIcon = ({ className = "", delay = 0 }: FloatingShapeProps) => (
  <motion.div
    className={`absolute ${className}`}
    animate={{ 
      y: [-5, 8, -5], 
      rotate: [-5, 5, -5],
      opacity: [0.15, 0.25, 0.15]
    }}
    transition={{ 
      duration: 6, 
      repeat: Infinity, 
      ease: "easeInOut",
      delay 
    }}
  >
    <svg viewBox="0 0 100 100" className="w-full h-full text-primary">
      <path fill="currentColor" d="M50 10c-15 0-28 8-28 25 0 12 5 20 8 35 2 10 5 20 10 20s8-5 10-15c2 10 5 15 10 15s8-10 10-20c3-15 8-23 8-35 0-17-13-25-28-25z"/>
    </svg>
  </motion.div>
);

export const SparkleIcon = ({ className = "", delay = 0 }: FloatingShapeProps) => (
  <motion.div
    className={`absolute ${className}`}
    animate={{ 
      scale: [1, 1.3, 1],
      rotate: [0, 180, 360],
      opacity: [0.2, 0.5, 0.2]
    }}
    transition={{ 
      duration: 4, 
      repeat: Infinity, 
      ease: "easeInOut",
      delay 
    }}
  >
    <svg viewBox="0 0 24 24" className="w-full h-full text-gold fill-gold">
      <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" />
    </svg>
  </motion.div>
);
