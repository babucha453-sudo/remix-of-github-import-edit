import { LucideIcon, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroStat {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: 'primary' | 'teal' | 'gold' | 'coral' | 'purple' | 'blue' | 'emerald' | 'pink' | 'cyan' | 'indigo';
  trend?: number;
  onClick?: () => void;
  progress?: number;
}

interface HeroStatsGridProps {
  stats: HeroStat[];
  variant?: 'default' | 'vibrant' | 'glass';
}

// Vibrant gradient backgrounds
const gradientBgClasses = {
  primary: 'bg-gradient-to-br from-primary to-primary/80',
  teal: 'bg-gradient-to-br from-teal to-emerald',
  gold: 'bg-gradient-to-br from-gold to-amber-500',
  coral: 'bg-gradient-to-br from-coral to-pink',
  purple: 'bg-gradient-to-br from-purple to-indigo',
  blue: 'bg-gradient-to-br from-blue-custom to-cyan',
  emerald: 'bg-gradient-to-br from-emerald to-teal',
  pink: 'bg-gradient-to-br from-pink to-rose-400',
  cyan: 'bg-gradient-to-br from-cyan to-teal',
  indigo: 'bg-gradient-to-br from-indigo to-purple',
};

// Card backgrounds for default variant
const cardBgClasses = {
  primary: 'bg-card border-2 border-primary/30 hover:border-primary/50',
  teal: 'bg-card border-2 border-teal/30 hover:border-teal/50',
  gold: 'bg-card border-2 border-gold/30 hover:border-gold/50',
  coral: 'bg-card border-2 border-coral/30 hover:border-coral/50',
  purple: 'bg-card border-2 border-purple/30 hover:border-purple/50',
  blue: 'bg-card border-2 border-blue-custom/30 hover:border-blue-custom/50',
  emerald: 'bg-card border-2 border-emerald/30 hover:border-emerald/50',
  pink: 'bg-card border-2 border-pink/30 hover:border-pink/50',
  cyan: 'bg-card border-2 border-cyan/30 hover:border-cyan/50',
  indigo: 'bg-card border-2 border-indigo/30 hover:border-indigo/50',
};

// Glass effect backgrounds
const glassBgClasses = {
  primary: 'bg-white/80 backdrop-blur-xl border border-primary/20 shadow-lg shadow-primary/5',
  teal: 'bg-white/80 backdrop-blur-xl border border-teal/20 shadow-lg shadow-teal/5',
  gold: 'bg-white/80 backdrop-blur-xl border border-gold/20 shadow-lg shadow-gold/5',
  coral: 'bg-white/80 backdrop-blur-xl border border-coral/20 shadow-lg shadow-coral/5',
  purple: 'bg-white/80 backdrop-blur-xl border border-purple/20 shadow-lg shadow-purple/5',
  blue: 'bg-white/80 backdrop-blur-xl border border-blue-custom/20 shadow-lg shadow-blue-custom/5',
  emerald: 'bg-white/80 backdrop-blur-xl border border-emerald/20 shadow-lg shadow-emerald/5',
  pink: 'bg-white/80 backdrop-blur-xl border border-pink/20 shadow-lg shadow-pink/5',
  cyan: 'bg-white/80 backdrop-blur-xl border border-cyan/20 shadow-lg shadow-cyan/5',
  indigo: 'bg-white/80 backdrop-blur-xl border border-indigo/20 shadow-lg shadow-indigo/5',
};

const iconBgClasses = {
  primary: 'bg-primary/15 text-primary',
  teal: 'bg-teal/15 text-teal',
  gold: 'bg-gold/15 text-gold',
  coral: 'bg-coral/15 text-coral',
  purple: 'bg-purple/15 text-purple',
  blue: 'bg-blue-custom/15 text-blue-custom',
  emerald: 'bg-emerald/15 text-emerald',
  pink: 'bg-pink/15 text-pink',
  cyan: 'bg-cyan/15 text-cyan',
  indigo: 'bg-indigo/15 text-indigo',
};

const textColorClasses = {
  primary: 'text-primary',
  teal: 'text-teal',
  gold: 'text-gold',
  coral: 'text-coral',
  purple: 'text-purple',
  blue: 'text-blue-custom',
  emerald: 'text-emerald',
  pink: 'text-pink',
  cyan: 'text-cyan',
  indigo: 'text-indigo',
};

const progressGradientClasses = {
  primary: 'bg-gradient-to-r from-primary to-teal',
  teal: 'bg-gradient-to-r from-teal to-emerald',
  gold: 'bg-gradient-to-r from-gold to-amber-500',
  coral: 'bg-gradient-to-r from-coral to-pink',
  purple: 'bg-gradient-to-r from-purple to-indigo',
  blue: 'bg-gradient-to-r from-blue-custom to-cyan',
  emerald: 'bg-gradient-to-r from-emerald to-teal',
  pink: 'bg-gradient-to-r from-pink to-coral',
  cyan: 'bg-gradient-to-r from-cyan to-teal',
  indigo: 'bg-gradient-to-r from-indigo to-purple',
};

export default function HeroStatsGrid({ stats, variant = 'default' }: HeroStatsGridProps) {
  const getBackgroundClass = (color: HeroStat['color']) => {
    switch (variant) {
      case 'vibrant':
        return gradientBgClasses[color];
      case 'glass':
        return glassBgClasses[color];
      default:
        return cardBgClasses[color];
    }
  };

  const isVibrant = variant === 'vibrant';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            onClick={stat.onClick}
            className={cn(
              'group relative overflow-hidden rounded-2xl p-4 transition-all duration-300',
              getBackgroundClass(stat.color),
              stat.onClick && 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]',
              isVibrant ? 'text-white shadow-lg hover:shadow-xl' : 'shadow-sm hover:shadow-md',
              'animate-fade-in'
            )}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            {/* Decorative gradient overlay for vibrant variant */}
            {isVibrant && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            )}
            
            {/* Decorative circle */}
            <div className={cn(
              'absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-20 blur-2xl',
              isVibrant ? 'bg-white' : 'bg-current'
            )} />
            
            {/* Icon */}
            <div className={cn(
              'h-11 w-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110',
              isVibrant ? 'bg-white/20' : iconBgClasses[stat.color]
            )}>
              <Icon className={cn('h-5 w-5', isVibrant ? 'text-white' : '')} />
            </div>
            
            {/* Value */}
            <div className="space-y-1 relative z-10">
              <p className={cn(
                'text-2xl font-extrabold tracking-tight',
                isVibrant ? 'text-white' : textColorClasses[stat.color]
              )}>
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </p>
              <p className={cn(
                'text-xs font-bold uppercase tracking-wide',
                isVibrant ? 'text-white/90' : 'text-foreground'
              )}>
                {stat.label}
              </p>
              {stat.subtitle && (
                <p className={cn(
                  'text-[11px] font-medium',
                  isVibrant ? 'text-white/70' : 'text-muted-foreground'
                )}>
                  {stat.subtitle}
                </p>
              )}
            </div>

            {/* Progress bar */}
            {stat.progress !== undefined && (
              <div className={cn(
                'mt-3 h-1.5 w-full rounded-full overflow-hidden',
                isVibrant ? 'bg-white/20' : 'bg-muted'
              )}>
                <div 
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    isVibrant ? 'bg-white' : progressGradientClasses[stat.color]
                  )}
                  style={{ width: `${Math.min(100, stat.progress)}%` }}
                />
              </div>
            )}
            
            {/* Trend indicator */}
            {stat.trend !== undefined && (
              <div className={cn(
                'mt-2 flex items-center gap-1 text-xs font-bold',
                isVibrant 
                  ? 'text-white/90' 
                  : stat.trend >= 0 ? 'text-emerald' : 'text-coral'
              )}>
                {stat.trend >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{stat.trend >= 0 ? '+' : ''}{stat.trend}%</span>
              </div>
            )}

            {/* Click indicator */}
            {stat.onClick && (
              <div className={cn(
                'absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity',
                isVibrant ? 'text-white/50' : 'text-muted-foreground/50'
              )}>
                <ArrowUpRight className="h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}