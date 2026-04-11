import { motion } from "framer-motion";

export const MobileHeroBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Dark gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

      {/* Large radial glow - Static */}
      <div
        className="absolute -top-20 -right-20 w-72 md:w-[600px] h-72 md:h-[600px] bg-primary/10 rounded-full opacity-60 pointer-events-none"
        style={{ filter: 'blur(100px)' }}
      />

      {/* Secondary glow - Static */}
      <div
        className="absolute -bottom-32 -left-32 w-64 md:w-[500px] h-64 md:h-[500px] bg-teal/10 rounded-full opacity-40 pointer-events-none"
        style={{ filter: 'blur(80px)' }}
      />

      {/* Center radial glow - Static */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 md:w-[800px] h-80 md:h-[800px] bg-primary/5 rounded-full pointer-events-none"
        style={{ filter: 'blur(120px)' }}
      />

      {/* Grid pattern - subtle */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Decorative crosses - Static */}
      <div className="absolute top-16 right-[12%] text-primary/10 text-5xl md:text-7xl font-bold select-none">+</div>
      <div className="absolute bottom-28 left-[6%] text-teal/10 text-4xl md:text-5xl font-bold select-none">+</div>

      {/* Floating circles - Static */}
      <div className="absolute bottom-36 right-[15%] w-20 md:w-28 h-20 md:h-28 border-2 border-primary/5 rounded-full" />
      <div className="absolute top-[30%] left-[8%] w-14 md:w-20 h-14 md:h-20 border border-teal/5 rounded-full" />

      {/* Glowing dots - Static and reduced */}
      <div className="absolute top-[18%] right-[10%] w-3 h-3 bg-primary/40 rounded-full" />
      <div className="absolute bottom-[28%] left-[12%] w-3 md:w-4 h-3 md:h-4 bg-teal/30 rounded-full" />

      {/* Curved decorative lines - Simplified */}
      <svg className="absolute top-0 left-0 w-full h-full opacity-[0.03]" viewBox="0 0 1440 800" preserveAspectRatio="none">
        <path
          d="M-100 500 Q 200 350 500 450 T 1000 350 T 1540 450"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          fill="none"
        />
      </svg>

      {/* Tooth/dental icon - Static */}
      <div className="absolute top-24 left-[18%] opacity-5">
        <svg viewBox="0 0 100 100" className="w-12 md:w-16 h-12 md:h-16 text-primary">
          <path fill="currentColor" d="M50 10c-15 0-28 8-28 25 0 12 5 20 8 35 2 10 5 20 10 20s8-5 10-15c2 10 5 15 10 15s8-10 10-20c3-15 8-23 8-35 0-17-13-25-28-25z" />
        </svg>
      </div>
    </div>
  );
};
