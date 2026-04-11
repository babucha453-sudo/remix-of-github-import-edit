import { motion } from "framer-motion";

export const EnhancedHeroBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Dark gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Large animated orbs */}
      <motion.div 
        className="absolute -top-32 -right-32 w-[700px] h-[700px] bg-gradient-to-br from-primary/30 via-teal/15 to-transparent rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 30, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <motion.div 
        className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-gradient-to-tr from-primary/25 via-emerald/15 to-transparent rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.25, 0.45, 0.25],
          x: [0, -20, 0],
          y: [0, 20, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      
      <motion.div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-gradient-radial from-gold/10 via-gold/5 to-transparent rounded-full"
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Center spotlight glow */}
      <motion.div 
        className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-gradient-radial from-primary/20 via-transparent to-transparent rounded-full blur-2xl"
        animate={{ 
          opacity: [0.2, 0.4, 0.2],
          scale: [1, 1.05, 1],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* Animated floating crosses */}
      <motion.div 
        className="absolute top-[12%] right-[15%] text-primary/25 text-6xl md:text-7xl font-black select-none hidden md:block"
        animate={{ y: [-10, 10, -10], opacity: [0.15, 0.35, 0.15], rotate: [0, 15, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        +
      </motion.div>
      <motion.div 
        className="absolute bottom-[20%] left-[8%] text-teal/20 text-5xl md:text-6xl font-black select-none hidden md:block"
        animate={{ y: [0, -12, 0], opacity: [0.1, 0.25, 0.1], rotate: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        +
      </motion.div>
      <motion.div 
        className="absolute top-[55%] right-[6%] text-gold/15 text-4xl font-black select-none hidden lg:block"
        animate={{ y: [5, -8, 5], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        +
      </motion.div>
      <motion.div 
        className="absolute top-[75%] left-[20%] text-coral/15 text-3xl font-black select-none hidden lg:block"
        animate={{ y: [-5, 8, -5], opacity: [0.08, 0.18, 0.08] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        +
      </motion.div>
      
      {/* Floating circles */}
      <motion.div 
        className="absolute bottom-[25%] right-[12%] w-24 h-24 md:w-32 md:h-32 border-2 border-primary/15 rounded-full hidden md:block"
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.25, 0.1], rotate: [0, 90, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute top-[28%] left-[10%] w-16 h-16 md:w-24 md:h-24 border border-teal/15 rounded-full hidden md:block"
        animate={{ y: [-8, 8, -8], scale: [1, 1.15, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute top-[15%] left-[25%] w-12 h-12 md:w-16 md:h-16 border border-gold/10 rounded-full hidden lg:block"
        animate={{ x: [-5, 8, -5], opacity: [0.08, 0.18, 0.08] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div 
        className="absolute bottom-[35%] left-[35%] w-10 h-10 border border-coral/10 rounded-full hidden lg:block"
        animate={{ y: [0, -10, 0], rotate: [0, 180, 360] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Glowing dots */}
      <motion.div 
        className="absolute top-[20%] right-[10%] w-3 h-3 bg-primary rounded-full shadow-lg shadow-primary/60 hidden md:block"
        animate={{ scale: [1, 2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
      <motion.div 
        className="absolute bottom-[30%] left-[15%] w-4 h-4 bg-teal rounded-full shadow-lg shadow-teal/60 hidden md:block"
        animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
      />
      <motion.div 
        className="absolute top-[45%] left-[5%] w-2 h-2 bg-gold rounded-full shadow-lg shadow-gold/50 hidden lg:block"
        animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2.2, repeat: Infinity, delay: 1 }}
      />
      <motion.div 
        className="absolute top-[65%] right-[20%] w-3 h-3 bg-coral rounded-full shadow-lg shadow-coral/50 hidden lg:block"
        animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.8, repeat: Infinity, delay: 0.8 }}
      />
      <motion.div 
        className="absolute top-[35%] right-[30%] w-2 h-2 bg-purple rounded-full shadow-lg shadow-purple/50 hidden lg:block"
        animate={{ scale: [1, 1.7, 1], opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 2.4, repeat: Infinity, delay: 1.2 }}
      />
      
      {/* Sparkle icons */}
      <motion.div 
        className="absolute top-[18%] left-[18%] hidden lg:block"
        animate={{ 
          scale: [1, 1.4, 1],
          rotate: [0, 180, 360],
          opacity: [0.15, 0.35, 0.15]
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-gold fill-gold">
          <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" />
        </svg>
      </motion.div>
      <motion.div 
        className="absolute bottom-[18%] right-[25%] hidden lg:block"
        animate={{ 
          scale: [1, 1.3, 1],
          rotate: [0, -180, -360],
          opacity: [0.1, 0.25, 0.1]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary fill-primary">
          <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" />
        </svg>
      </motion.div>
      
      {/* Tooth icon floating */}
      <motion.div 
        className="absolute top-[25%] right-[35%] opacity-15 hidden lg:block"
        animate={{ y: [-8, 10, -8], rotate: [-8, 8, -8] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 100 100" className="w-14 h-14 text-primary">
          <path fill="currentColor" d="M50 10c-15 0-28 8-28 25 0 12 5 20 8 35 2 10 5 20 10 20s8-5 10-15c2 10 5 15 10 15s8-10 10-20c3-15 8-23 8-35 0-17-13-25-28-25z"/>
        </svg>
      </motion.div>
      <motion.div 
        className="absolute bottom-[40%] left-[6%] opacity-10 hidden lg:block"
        animate={{ y: [0, -12, 0], rotate: [5, -5, 5] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <svg viewBox="0 0 100 100" className="w-10 h-10 text-teal">
          <path fill="currentColor" d="M50 10c-15 0-28 8-28 25 0 12 5 20 8 35 2 10 5 20 10 20s8-5 10-15c2 10 5 15 10 15s8-10 10-20c3-15 8-23 8-35 0-17-13-25-28-25z"/>
        </svg>
      </motion.div>
      
      {/* Curved decorative lines */}
      <svg className="absolute top-0 left-0 w-full h-full opacity-[0.06] hidden md:block" viewBox="0 0 1440 800" preserveAspectRatio="none">
        <motion.path 
          d="M-100 500 Q 200 350 500 450 T 1000 350 T 1540 450" 
          stroke="hsl(var(--primary))" 
          strokeWidth="2" 
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
        <motion.path 
          d="M-100 580 Q 300 430 600 530 T 1100 430 T 1540 530" 
          stroke="hsl(var(--teal))" 
          strokeWidth="1.5" 
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 3.5, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.path 
          d="M-100 660 Q 400 510 700 610 T 1200 510 T 1540 610" 
          stroke="hsl(var(--gold))" 
          strokeWidth="1" 
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 4, ease: "easeInOut", delay: 1 }}
        />
      </svg>
      
      {/* Gradient rays from top center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-[600px] opacity-[0.05] pointer-events-none hidden md:block"
        style={{
          background: 'conic-gradient(from 180deg at 50% 0%, transparent 0deg, hsl(var(--primary)) 30deg, transparent 60deg, transparent 120deg, hsl(var(--teal)) 150deg, transparent 180deg, transparent 240deg, hsl(var(--gold)) 270deg, transparent 300deg, transparent 360deg)',
        }}
      />
    </div>
  );
};
