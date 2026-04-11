import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

interface StatCardDarkProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'primary' | 'teal' | 'gold' | 'coral' | 'purple' | 'blue' | 'emerald' | 'pink' | 'indigo' | 'cyan';
  trend?: number;
  trendLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  variant?: 'solid' | 'outlined' | 'ghost' | 'gradient' | 'glass';
}

export default function StatCardDark({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
  trend,
  trendLabel,
  size = 'md',
  onClick,
  className,
  variant = 'outlined',
}: StatCardDarkProps) {
  // Vibrant color configurations
  const colorConfig = {
    primary: {
      solid: 'bg-gradient-to-br from-primary to-primary/80 text-white',
      gradient: 'bg-gradient-to-br from-primary via-primary/90 to-teal text-white',
      outlined: 'bg-card border-2 border-primary/40 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10',
      ghost: 'bg-primary/8 border border-primary/15 hover:bg-primary/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-primary/20 shadow-lg shadow-primary/5',
      text: 'text-primary',
      iconBg: 'bg-gradient-to-br from-primary/20 to-primary/10',
      accent: 'text-primary',
    },
    teal: {
      solid: 'bg-gradient-to-br from-teal to-teal/80 text-white',
      gradient: 'bg-gradient-to-br from-teal via-teal/90 to-emerald text-white',
      outlined: 'bg-card border-2 border-teal/40 hover:border-teal/60 hover:shadow-lg hover:shadow-teal/10',
      ghost: 'bg-teal/8 border border-teal/15 hover:bg-teal/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-teal/20 shadow-lg shadow-teal/5',
      text: 'text-teal',
      iconBg: 'bg-gradient-to-br from-teal/20 to-teal/10',
      accent: 'text-teal',
    },
    gold: {
      solid: 'bg-gradient-to-br from-gold to-amber-500 text-white',
      gradient: 'bg-gradient-to-br from-gold via-amber-500 to-orange-400 text-white',
      outlined: 'bg-card border-2 border-gold/40 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/10',
      ghost: 'bg-gold/8 border border-gold/15 hover:bg-gold/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-gold/20 shadow-lg shadow-gold/5',
      text: 'text-gold',
      iconBg: 'bg-gradient-to-br from-gold/20 to-gold/10',
      accent: 'text-gold',
    },
    coral: {
      solid: 'bg-gradient-to-br from-coral to-coral/80 text-white',
      gradient: 'bg-gradient-to-br from-coral via-rose-500 to-pink text-white',
      outlined: 'bg-card border-2 border-coral/40 hover:border-coral/60 hover:shadow-lg hover:shadow-coral/10',
      ghost: 'bg-coral/8 border border-coral/15 hover:bg-coral/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-coral/20 shadow-lg shadow-coral/5',
      text: 'text-coral',
      iconBg: 'bg-gradient-to-br from-coral/20 to-coral/10',
      accent: 'text-coral',
    },
    purple: {
      solid: 'bg-gradient-to-br from-purple to-purple/80 text-white',
      gradient: 'bg-gradient-to-br from-purple via-violet-500 to-indigo text-white',
      outlined: 'bg-card border-2 border-purple/40 hover:border-purple/60 hover:shadow-lg hover:shadow-purple/10',
      ghost: 'bg-purple/8 border border-purple/15 hover:bg-purple/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-purple/20 shadow-lg shadow-purple/5',
      text: 'text-purple',
      iconBg: 'bg-gradient-to-br from-purple/20 to-purple/10',
      accent: 'text-purple',
    },
    blue: {
      solid: 'bg-gradient-to-br from-blue-custom to-blue-custom/80 text-white',
      gradient: 'bg-gradient-to-br from-blue-custom via-blue-500 to-cyan text-white',
      outlined: 'bg-card border-2 border-blue-custom/40 hover:border-blue-custom/60 hover:shadow-lg hover:shadow-blue-custom/10',
      ghost: 'bg-blue-custom/8 border border-blue-custom/15 hover:bg-blue-custom/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-blue-custom/20 shadow-lg shadow-blue-custom/5',
      text: 'text-blue-custom',
      iconBg: 'bg-gradient-to-br from-blue-custom/20 to-blue-custom/10',
      accent: 'text-blue-custom',
    },
    emerald: {
      solid: 'bg-gradient-to-br from-emerald to-emerald/80 text-white',
      gradient: 'bg-gradient-to-br from-emerald via-teal to-cyan text-white',
      outlined: 'bg-card border-2 border-emerald/40 hover:border-emerald/60 hover:shadow-lg hover:shadow-emerald/10',
      ghost: 'bg-emerald/8 border border-emerald/15 hover:bg-emerald/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-emerald/20 shadow-lg shadow-emerald/5',
      text: 'text-emerald',
      iconBg: 'bg-gradient-to-br from-emerald/20 to-emerald/10',
      accent: 'text-emerald',
    },
    pink: {
      solid: 'bg-gradient-to-br from-pink to-pink/80 text-white',
      gradient: 'bg-gradient-to-br from-pink via-rose-400 to-coral text-white',
      outlined: 'bg-card border-2 border-pink/40 hover:border-pink/60 hover:shadow-lg hover:shadow-pink/10',
      ghost: 'bg-pink/8 border border-pink/15 hover:bg-pink/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-pink/20 shadow-lg shadow-pink/5',
      text: 'text-pink',
      iconBg: 'bg-gradient-to-br from-pink/20 to-pink/10',
      accent: 'text-pink',
    },
    indigo: {
      solid: 'bg-gradient-to-br from-indigo to-indigo/80 text-white',
      gradient: 'bg-gradient-to-br from-indigo via-purple to-blue-custom text-white',
      outlined: 'bg-card border-2 border-indigo/40 hover:border-indigo/60 hover:shadow-lg hover:shadow-indigo/10',
      ghost: 'bg-indigo/8 border border-indigo/15 hover:bg-indigo/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-indigo/20 shadow-lg shadow-indigo/5',
      text: 'text-indigo',
      iconBg: 'bg-gradient-to-br from-indigo/20 to-indigo/10',
      accent: 'text-indigo',
    },
    cyan: {
      solid: 'bg-gradient-to-br from-cyan to-cyan/80 text-white',
      gradient: 'bg-gradient-to-br from-cyan via-teal to-emerald text-white',
      outlined: 'bg-card border-2 border-cyan/40 hover:border-cyan/60 hover:shadow-lg hover:shadow-cyan/10',
      ghost: 'bg-cyan/8 border border-cyan/15 hover:bg-cyan/12',
      glass: 'bg-white/80 backdrop-blur-lg border border-cyan/20 shadow-lg shadow-cyan/5',
      text: 'text-cyan',
      iconBg: 'bg-gradient-to-br from-cyan/20 to-cyan/10',
      accent: 'text-cyan',
    },
  };

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  const valueSizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  const iconSizeClasses = {
    sm: 'h-11 w-11',
    md: 'h-13 w-13',
    lg: 'h-16 w-16',
  };

  const iconIconSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const config = colorConfig[color];
  const isSolid = variant === 'solid' || variant === 'gradient';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl transition-all duration-300',
        config[variant],
        onClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
      onClick={onClick}
    >
      {/* Decorative gradient overlay for solid variants */}
      {isSolid && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      )}
      
      {/* Decorative circles for visual interest */}
      <div className={cn(
        'absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-20 blur-xl',
        isSolid ? 'bg-white' : config.iconBg
      )} />
      
      <div className={cn('relative z-10', sizeClasses[size])}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <p className={cn(
              'text-xs font-bold uppercase tracking-wider',
              isSolid ? 'text-white/80' : 'text-muted-foreground'
            )}>
              {title}
            </p>
            <p className={cn(
              'font-extrabold tracking-tight animate-count-up',
              valueSizeClasses[size],
              isSolid ? 'text-white' : 'text-foreground'
            )}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className={cn(
                'text-sm font-medium',
                isSolid ? 'text-white/70' : 'text-muted-foreground'
              )}>
                {subtitle}
              </p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-2 pt-1">
                <div className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
                  trend >= 0 
                    ? (isSolid ? 'bg-white/25 text-white' : 'bg-emerald/15 text-emerald') 
                    : (isSolid ? 'bg-white/25 text-white' : 'bg-coral/15 text-coral')
                )}>
                  {trend >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {trend >= 0 ? '+' : ''}{trend}%
                </div>
                {trendLabel && (
                  <span className={cn(
                    'text-xs font-medium',
                    isSolid ? 'text-white/60' : 'text-muted-foreground'
                  )}>
                    {trendLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div
            className={cn(
              'rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300',
              isSolid ? 'bg-white/20' : config.iconBg,
              iconSizeClasses[size],
              onClick && 'group-hover:scale-110'
            )}
          >
            <Icon className={cn(
              isSolid ? 'text-white' : config.accent,
              iconIconSizeClasses[size]
            )} />
          </div>
        </div>
        
        {/* Click indicator */}
        {onClick && (
          <div className={cn(
            'absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity',
            isSolid ? 'text-white/60' : 'text-muted-foreground'
          )}>
            <ArrowUpRight className="h-4 w-4" />
          </div>
        )}
      </div>
      
      {/* Accent line at top for outlined/glass variants */}
      {(variant === 'outlined' || variant === 'glass') && (
        <div className={cn(
          'absolute top-0 left-0 right-0 h-1 rounded-t-2xl',
          `bg-gradient-to-r`,
          color === 'primary' && 'from-primary to-teal',
          color === 'teal' && 'from-teal to-emerald',
          color === 'gold' && 'from-gold to-amber-500',
          color === 'coral' && 'from-coral to-pink',
          color === 'purple' && 'from-purple to-indigo',
          color === 'blue' && 'from-blue-custom to-cyan',
          color === 'emerald' && 'from-emerald to-teal',
          color === 'pink' && 'from-pink to-coral',
          color === 'indigo' && 'from-indigo to-purple',
          color === 'cyan' && 'from-cyan to-teal',
        )} />
      )}
    </div>
  );
}