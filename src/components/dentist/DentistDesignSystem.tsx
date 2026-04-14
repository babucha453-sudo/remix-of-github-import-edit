import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function DashboardCard({ 
  children, 
  className, 
  variant = 'default',
  size = 'md',
  onClick 
}: DashboardCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        // Base styles
        'rounded-xl border transition-all duration-300',
        // Sizes
        size === 'sm' && 'p-3',
        size === 'md' && 'p-4',
        size === 'lg' && 'p-6',
        // Variants
        variant === 'default' && 'bg-background border-border hover:border-primary/30',
        variant === 'gradient' && 'bg-gradient-to-br from-primary/5 to-teal/5 border-primary/20 hover:shadow-lg hover:shadow-primary/10',
        variant === 'glass' && 'bg-white/50 backdrop-blur-sm border-primary/10',
        // Interactive
        onClick && 'cursor-pointer hover:scale-[1.02] hover:-translate-y-1',
        className
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'teal' | 'gold' | 'coral';
  onClick?: () => void;
}

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle, 
  trend,
  color = 'primary',
  onClick 
}: StatCardProps) {
  const colorClasses = {
    primary: 'from-primary/20 to-teal/10 text-primary',
    teal: 'from-teal/20 to-emerald/10 text-teal',
    gold: 'from-gold/20 to-amber/10 text-gold',
    coral: 'from-coral/20 to-pink/10 text-coral',
  };
  
  const iconBgClasses = {
    primary: 'bg-primary/10 text-primary',
    teal: 'bg-teal/10 text-teal',
    gold: 'bg-gold/10 text-gold',
    coral: 'bg-coral/10 text-coral',
  };

  return (
    <DashboardCard variant="gradient" size="md" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', iconBgClasses[color])}>
          <Icon className="h-4 w-4" />
        </div>
        {trend && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            trend === 'up' && 'bg-emerald-100 text-emerald-600',
            trend === 'down' && 'bg-red-100 text-red-600',
            trend === 'neutral' && 'bg-muted text-muted-foreground'
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {Math.abs(Math.random() * 20 - 10).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {subtitle && <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>}
    </DashboardCard>
  );
}

interface InfoRowProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function InfoRow({ label, value, icon: Icon, variant = 'default' }: InfoRowProps) {
  const variantClasses = {
    default: '',
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    error: 'text-red-600 bg-red-50',
  };

  return (
    <div className={cn('flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50', variantClasses[variant])}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface MiniChartProps {
  data: number[];
  height?: number;
  color?: string;
}

export function MiniChart({ data, height = 40, color = 'primary' }: MiniChartProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((value, i) => {
        const normalizedHeight = ((value - min) / range) * 100;
        return (
          <div
            key={i}
            className={cn('flex-1 rounded-t transition-all', `bg-${color}/60`)}
            style={{ height: `${normalizedHeight}%` }}
          />
        );
      })}
    </div>
  );
}

export const designSystem = {
  colors: {
    primary: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      border: 'border-primary/20',
      gradient: 'from-primary/20 to-teal/10',
    },
    teal: {
      bg: 'bg-teal/10',
      text: 'text-teal',
      border: 'border-teal/20',
      gradient: 'from-teal/20 to-emerald/10',
    },
    gold: {
      bg: 'bg-gold/10',
      text: 'text-gold',
      border: 'border-gold/20',
      gradient: 'from-gold/20 to-amber/10',
    },
    coral: {
      bg: 'bg-coral/10',
      text: 'text-coral',
      border: 'border-coral/20',
      gradient: 'from-coral/20 to-pink/10',
    },
  },
  spacing: {
    card: 'p-4',
    section: 'space-y-4',
  },
  borderRadius: {
    card: 'rounded-xl',
    button: 'rounded-lg',
  },
};