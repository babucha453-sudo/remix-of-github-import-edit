import { LucideIcon, ArrowUpRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  variant?: 'default' | 'filled' | 'outlined';
  color?: 'primary' | 'teal' | 'gold' | 'coral' | 'purple' | 'blue';
  onClick?: () => void;
  className?: string;
}

export default function ModernStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  variant = 'default',
  color = 'primary',
  onClick,
  className,
}: ModernStatCardProps) {
  const colorConfig = {
    primary: {
      filled: 'bg-primary text-white',
      filledIcon: 'bg-white/20 text-white',
      accent: 'text-primary',
      iconBg: 'bg-primary/10',
      border: 'border-primary/20',
      trendBg: 'bg-white/20',
      trendText: 'text-white',
    },
    teal: {
      filled: 'bg-teal text-white',
      filledIcon: 'bg-white/20 text-white',
      accent: 'text-teal',
      iconBg: 'bg-teal/10',
      border: 'border-teal/20',
      trendBg: 'bg-white/20',
      trendText: 'text-white',
    },
    gold: {
      filled: 'bg-gradient-to-br from-gold to-amber-500 text-white',
      filledIcon: 'bg-white/20 text-white',
      accent: 'text-gold',
      iconBg: 'bg-gold/10',
      border: 'border-gold/20',
      trendBg: 'bg-white/20',
      trendText: 'text-white',
    },
    coral: {
      filled: 'bg-coral text-white',
      filledIcon: 'bg-white/20 text-white',
      accent: 'text-coral',
      iconBg: 'bg-coral/10',
      border: 'border-coral/20',
      trendBg: 'bg-white/20',
      trendText: 'text-white',
    },
    purple: {
      filled: 'bg-purple text-white',
      filledIcon: 'bg-white/20 text-white',
      accent: 'text-purple',
      iconBg: 'bg-purple/10',
      border: 'border-purple/20',
      trendBg: 'bg-white/20',
      trendText: 'text-white',
    },
    blue: {
      filled: 'bg-blue-custom text-white',
      filledIcon: 'bg-white/20 text-white',
      accent: 'text-blue-custom',
      iconBg: 'bg-blue-custom/10',
      border: 'border-blue-custom/20',
      trendBg: 'bg-white/20',
      trendText: 'text-white',
    },
  };

  const config = colorConfig[color];
  const isFilled = variant === 'filled';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl transition-all duration-200 group',
        isFilled ? config.filled : 'bg-card border border-border/50 hover:border-border hover:shadow-md',
        onClick && 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]',
        className
      )}
      onClick={onClick}
    >
      <div className="p-5">
        {/* Header with title and arrow */}
        <div className="flex items-start justify-between mb-3">
          <p className={cn(
            'text-sm font-semibold',
            isFilled ? 'text-white/90' : 'text-foreground'
          )}>
            {title}
          </p>
          <button 
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
              isFilled 
                ? 'bg-white/15 hover:bg-white/25 text-white' 
                : 'bg-muted/50 hover:bg-muted text-muted-foreground'
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        {/* Value */}
        <p className={cn(
          'text-4xl font-extrabold tracking-tight mb-2',
          isFilled ? 'text-white' : config.accent
        )}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>

        {/* Trend indicator */}
        {(trend !== undefined || subtitle) && (
          <div className={cn(
            'flex items-center gap-2 text-sm',
            isFilled ? 'text-white/80' : 'text-muted-foreground'
          )}>
            {trend !== undefined && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                isFilled 
                  ? 'bg-white/20 text-white' 
                  : 'bg-emerald/10 text-emerald'
              )}>
                <TrendingUp className="h-3 w-3" />
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
            )}
            <span className={isFilled ? 'text-white/70' : ''}>
              {subtitle || trendLabel || 'from last month'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
