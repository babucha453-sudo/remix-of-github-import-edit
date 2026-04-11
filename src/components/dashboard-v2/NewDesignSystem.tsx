/**
 * New Dentist Dashboard Design System
 * Modern, clean, minimalist design with bold typography
 */

import { ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowRight, Loader2 } from 'lucide-react';

// ============================================
// DESIGN TOKENS - New Design
// ============================================
export const newDesign = {
  colors: {
    primary: 'from-indigo-600 to-violet-600',
    primaryHover: 'hover:from-indigo-700 hover:to-violet-700',
    accent: 'from-amber-500 to-orange-500',
    success: 'from-emerald-500 to-teal-500',
    info: 'from-blue-500 to-cyan-500',
  },
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
  },
  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg shadow-black/10',
    xl: 'shadow-xl shadow-black/15',
    glow: 'shadow-lg shadow-indigo-500/25',
    glowTeal: 'shadow-lg shadow-teal-500/25',
  },
  transition: 'all duration-200 ease-in-out',
};

// ============================================
// NEW CARD COMPONENTS
// ============================================
interface ModernCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'gradient' | 'solid' | 'bordered';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const ModernCard = forwardRef<HTMLDivElement, ModernCardProps>(
  ({ children, className, variant = 'default', hover = false, padding = 'md', onClick }, ref) => {
    const baseStyles = 'relative';
    
    const variantStyles = {
      default: 'bg-white border border-gray-200',
      glass: 'bg-white/70 backdrop-blur-lg border border-white/50 shadow-md',
      gradient: 'bg-gradient-to-br from-white to-gray-50 border border-gray-100',
      solid: 'bg-gray-900 text-white',
      bordered: 'bg-transparent border-2 border-gray-200',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    };

    const hoverStyles = hover
      ? 'cursor-pointer hover:shadow-xl hover:-translate-y-0.5 hover:border-indigo-200'
      : '';

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          baseStyles,
          newDesign.radius.lg,
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles,
          newDesign.transition,
          className
        )}
      >
        {children}
      </div>
    );
  }
);
ModernCard.displayName = 'ModernCard';

// ============================================
// STATISTICS CARD
// ============================================
interface StatsCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  onClick?: () => void;
}

export const StatsCard = ({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'text-indigo-600',
  onClick,
}: StatsCardProps) => {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <ModernCard hover={!!onClick} onClick={onClick} padding="md">
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center bg-gray-100')}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        )}
        {change !== undefined && (
          <span className={cn(
            'text-xs font-semibold px-2 py-1 rounded-full',
            isPositive ? 'bg-emerald-100 text-emerald-700' : 
            isNegative ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
          )}>
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {changeLabel && (
          <p className="text-xs text-gray-400 mt-1">{changeLabel}</p>
        )}
      </div>
    </ModernCard>
  );
};

// ============================================
// PROGRESS RING CARD
// ============================================
interface ProgressRingCardProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  subtitle?: string;
}

export const ProgressRingCard = ({
  label,
  value,
  max,
  color = 'text-indigo-600',
  subtitle,
}: ProgressRingCardProps) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <ModernCard padding="md">
      <div className="flex items-center justify-center">
        <div className="relative h-24 w-24">
          <svg className="h-24 w-24 -rotate-90 transform">
            <circle
              cx="48"
              cy="48"
              r="36"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="48"
              cy="48"
              r="36"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className={cn(color)}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-gray-900">{Math.round(percentage)}%</span>
          </div>
        </div>
      </div>
      <p className="text-center font-semibold text-gray-900 mt-3">{label}</p>
      {subtitle && <p className="text-center text-sm text-gray-500 mt-1">{subtitle}</p>}
    </ModernCard>
  );
};

// ============================================
// ACTION BUTTON
// ============================================
interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  onClick: () => void;
  color?: string;
}

export const ActionButton = ({ 
  icon: Icon, 
  label, 
  description, 
  onClick, 
  color = 'bg-indigo-600',
}: ActionButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-2 p-4 rounded-xl',
      'bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-lg',
      'transition-all duration-200 hover:-translate-y-0.5',
      'text-center group'
    )}
  >
    <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center', color)}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div>
      <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{label}</p>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
  </button>
);

// ============================================
// SECTION HEADER
// ============================================
interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export const SectionTitle = ({ title, subtitle, action }: SectionTitleProps) => (
  <div className="flex items-start justify-between mb-5">
    <div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ============================================
// STATUS BADGE
// ============================================
interface StatusBadgeNewProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  label: string;
}

export const StatusBadgeNew = ({ status, label }: StatusBadgeNewProps) => {
  const styles = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium border', styles[status])}>
      {label}
    </span>
  );
};

// ============================================
// EMPTY STATE
// ============================================
interface EmptyStateNewProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyStateNew = ({ icon: Icon, title, description, action }: EmptyStateNewProps) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    {Icon && (
      <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-gray-400" />
      </div>
    )}
    <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
    {description && <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>}
    {action}
  </div>
);

// ============================================
// ACTIVITY ITEM
// ============================================
interface ActivityItemProps {
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: string;
  description?: string;
  time?: string;
  onClick?: () => void;
}

export const ActivityItem = ({
  icon: Icon,
  iconBg = 'bg-indigo-100',
  iconColor = 'text-indigo-600',
  title,
  description,
  time,
  onClick,
}: ActivityItemProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
  >
    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
      <Icon className={cn('h-4 w-4', iconColor)} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
      {description && <p className="text-xs text-gray-500 truncate">{description}</p>}
    </div>
    {time && <span className="text-xs text-gray-400 flex-shrink-0">{time}</span>}
  </button>
);

// ============================================
// LOADING SKELETON
// ============================================
export const SkeletonNew = ({ className }: { className?: string }) => (
  <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />
);

export const StatsCardSkeleton = () => (
  <ModernCard padding="md">
    <div className="flex items-start justify-between mb-3">
      <SkeletonNew className="h-10 w-10 rounded-xl" />
    </div>
    <SkeletonNew className="h-7 w-20 mb-1" />
    <SkeletonNew className="h-4 w-32" />
  </ModernCard>
);
