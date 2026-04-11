import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'primary' | 'teal' | 'gold' | 'coral' | 'purple' | 'blue' | 'emerald';
  trend?: number;
  trendLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

export default function StatCard({
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
}: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    teal: 'bg-teal/10 text-teal border-teal/20',
    gold: 'bg-gold/10 text-gold border-gold/20',
    coral: 'bg-coral/10 text-coral border-coral/20',
    purple: 'bg-purple/10 text-purple border-purple/20',
    blue: 'bg-blue-custom/10 text-blue-custom border-blue-custom/20',
    emerald: 'bg-emerald/10 text-emerald border-emerald/20',
  };

  const iconBgClasses = {
    primary: 'bg-primary/10',
    teal: 'bg-teal/10',
    gold: 'bg-gold/10',
    coral: 'bg-coral/10',
    purple: 'bg-purple/10',
    blue: 'bg-blue-custom/10',
    emerald: 'bg-emerald/10',
  };

  const iconColorClasses = {
    primary: 'text-primary',
    teal: 'text-teal',
    gold: 'text-gold',
    coral: 'text-coral',
    purple: 'text-purple',
    blue: 'text-blue-custom',
    emerald: 'text-emerald',
  };

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const valueSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const iconSizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  const iconIconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-7 w-7',
  };

  return (
    <Card
      className={cn(
        'card-stat transition-all',
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <CardContent className={sizeClasses[size]}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className={cn('font-bold', valueSizeClasses[size])}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1 pt-1">
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-teal" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-coral" />
                )}
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend >= 0 ? 'text-teal' : 'text-coral'
                  )}
                >
                  {trend >= 0 ? '+' : ''}{trend}%
                  {trendLabel && ` ${trendLabel}`}
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              'rounded-xl flex items-center justify-center',
              iconBgClasses[color],
              iconSizeClasses[size]
            )}
          >
            <Icon className={cn(iconColorClasses[color], iconIconSizeClasses[size])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
