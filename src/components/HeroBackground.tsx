export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Dark gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Animated gradient orbs */}
      <div 
        className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-gradient-to-br from-primary/30 via-teal/20 to-transparent rounded-full blur-3xl"
        style={{ animation: 'pulse 6s ease-in-out infinite' }}
      />
      <div 
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gradient-to-tr from-primary/20 via-emerald/15 to-transparent rounded-full blur-3xl"
        style={{ animation: 'pulse 8s ease-in-out infinite', animationDelay: '2s' }}
      />
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/10 via-transparent to-transparent rounded-full"
        style={{ animation: 'pulse 10s ease-in-out infinite', animationDelay: '1s' }}
      />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Floating elements - dark theme */}
      <div className="absolute top-24 left-[15%] w-20 h-20 float-slow" style={{ animationDelay: '0s' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-primary/30">
          <path fill="currentColor" d="M50 10c-15 0-28 8-28 25 0 12 5 20 8 35 2 10 5 20 10 20s8-5 10-15c2 10 5 15 10 15s8-10 10-20c3-15 8-23 8-35 0-17-13-25-28-25z"/>
        </svg>
      </div>
      
      {/* Decorative crosses */}
      <div className="absolute top-32 right-[20%] text-primary/20 text-6xl font-bold float-animation" style={{ animationDelay: '1s' }}>+</div>
      <div className="absolute bottom-40 left-[8%] text-teal/20 text-4xl font-bold float-slow" style={{ animationDelay: '2s' }}>+</div>
      <div className="absolute top-[60%] right-[12%] text-emerald/15 text-3xl font-bold float-animation" style={{ animationDelay: '3s' }}>+</div>
      
      {/* Floating circles */}
      <div className="absolute bottom-32 right-[18%] w-28 h-28 border-2 border-primary/10 rounded-full float-slow" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-40 right-[40%] w-20 h-20 border border-teal/10 rounded-full float-animation" style={{ animationDelay: '3s' }} />
      <div className="absolute bottom-[30%] left-[5%] w-16 h-16 border border-emerald/10 rounded-full float-slow" style={{ animationDelay: '2.5s' }} />
      
      {/* Glowing dots */}
      <div className="absolute top-[25%] right-[8%] w-2 h-2 bg-primary rounded-full shadow-lg shadow-primary/50 animate-pulse" />
      <div className="absolute bottom-[35%] left-[12%] w-3 h-3 bg-teal rounded-full shadow-lg shadow-teal/50 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-[55%] left-[25%] w-2 h-2 bg-emerald rounded-full shadow-lg shadow-emerald/50 animate-pulse" style={{ animationDelay: '2s' }} />
      
      {/* Curved decorative lines */}
      <svg className="absolute top-0 left-0 w-full h-full opacity-[0.08]" viewBox="0 0 1440 800" preserveAspectRatio="none">
        <path 
          d="M-100 600 Q 200 400 500 500 T 1000 400 T 1540 500" 
          stroke="hsl(var(--primary))" 
          strokeWidth="2" 
          fill="none"
        />
        <path 
          d="M-100 650 Q 300 450 600 550 T 1100 450 T 1540 550" 
          stroke="hsl(var(--teal))" 
          strokeWidth="1.5" 
          fill="none"
        />
        <path 
          d="M-100 700 Q 400 500 700 600 T 1200 500 T 1540 600" 
          stroke="hsl(var(--emerald))" 
          strokeWidth="1" 
          fill="none"
        />
      </svg>
    </div>
  );
}
