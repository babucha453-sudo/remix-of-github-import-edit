/**
 * AppointPanda Premium Design System v2
 * A collection of reusable components with consistent styling
 * Professional UX-focused design with glassmorphism and modern aesthetics
 */

import { ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowRight, Loader2, Check, X, AlertTriangle } from 'lucide-react';

// ============================================
// DESIGN TOKENS
// ============================================
export const designTokens = {
  radius: {
    sm: 'rounded-xl',
    md: 'rounded-2xl',
    lg: 'rounded-3xl',
    xl: 'rounded-[2rem]',
    full: 'rounded-full',
  },
  shadow: {
    sm: 'shadow-sm',
    md: 'shadow-md shadow-black/5',
    lg: 'shadow-lg shadow-black/8',
    xl: 'shadow-xl shadow-black/10',
    glow: 'shadow-lg shadow-primary/20',
    glowTeal: 'shadow-lg shadow-teal/20',
    glowAmber: 'shadow-lg shadow-amber/20',
  },
  transition: 'transition-all duration-300 ease-out',
  glass: 'backdrop-blur-xl bg-white/80',
};

// ============================================
// CARD COMPONENTS
// ============================================
interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'gradient' | 'elevated' | 'outlined' | 'premium';
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  onClick?: () => void;
  gradient?: string;
}

export const PremiumCard = forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ children, className, variant = 'default', hover = false, padding = 'md', onClick, gradient }, ref) => {
    const baseStyles = 'relative overflow-hidden';
    
    const variantStyles = {
      default: 'bg-card border border-border/50 shadow-sm',
      glass: designTokens.glass + ' border border-white/20 shadow-lg',
      gradient: gradient || 'bg-gradient-to-br from-card via-muted/20 to-card border border-border/30',
      elevated: 'bg-card shadow-xl shadow-black/5 border-0',
      outlined: 'bg-transparent border-2 border-border',
      premium: 'bg-gradient-to-br from-white to-muted/30 border border-border/30 shadow-lg',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const hoverStyles = hover
      ? 'cursor-pointer hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/20'
      : '';

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          baseStyles,
          'rounded-2xl',
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles,
          designTokens.transition,
          className
        )}
      >
        {children}
      </div>
    );
  }
);
PremiumCard.displayName = 'PremiumCard';

// ============================================
// METRIC CARD - For dashboard statistics
// ============================================
interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  iconColor?: string;
  iconBg?: string;
  onClick?: () => void;
  suffix?: string;
  loading?: boolean;
}

export const MetricCard = ({
  label,
  value,
  icon: Icon,
  trend,
  iconColor = 'text-primary',
  iconBg = 'bg-primary/10',
  onClick,
  suffix,
  loading = false,
}: MetricCardProps) => {
  return (
    <PremiumCard hover={!!onClick} onClick={onClick} padding="md">
      <div className="flex items-start justify-between">
        {Icon && (
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        )}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
            trend.value > 0 ? 'bg-emerald-50 text-emerald-600' : 
            trend.value < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'
          )}>
            {trend.value > 0 ? <TrendingUp className="h-3 w-3" /> : trend.value < 0 ? <TrendingUp className="h-3 w-3 rotate-180" /> : null}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      
      <div className="mt-4">
        {loading ? (
          <div className="h-8 w-20 bg-muted animate-pulse rounded-lg" />
        ) : (
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
            {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </PremiumCard>
  );
};

// Re-export for backwards compatibility
const TrendingUp = ({ className, rotate }: { className?: string; rotate?: number }) => (
  <svg className={className} style={rotate ? { transform: `rotate(${rotate}deg)` } : {}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

// ============================================
// STAT CARD
// ============================================
interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: number; label?: string };
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  onClick?: () => void;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  action?: { label: string; onClick: () => void };
}

export const StatCard = ({
  label,
  value,
  change,
  icon: Icon,
  iconColor = 'text-primary',
  iconBg = 'bg-primary/10',
  onClick,
  trend,
  loading = false,
  action,
}: StatCardProps) => {
  return (
    <PremiumCard
      hover={!!onClick}
      onClick={onClick}
      className="group"
      padding="sm"
    >
      <div className="flex items-start justify-between">
        {Icon && (
          <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon className={cn('h-4 w-4', iconColor)} />
          </div>
        )}
        {onClick && (
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        )}
      </div>
      
      <div className="mt-3">
        {loading ? (
          <div className="h-7 w-20 bg-muted animate-pulse rounded-lg" />
        ) : (
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>

      {change && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-xs font-medium',
          trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-coral' : 'text-muted-foreground'
        )}>
          {trend === 'up' && <span>↑</span>}
          {trend === 'down' && <span>↓</span>}
          <span>{change.value > 0 ? '+' : ''}{change.value}</span>
          {change.label && <span className="text-muted-foreground">{change.label}</span>}
        </div>
      )}

      {action && (
        <button
          onClick={(e) => { e.stopPropagation(); action.onClick(); }}
          className="mt-3 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 group/btn"
        >
          {action.label}
          <ArrowRight className="h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
      )}
    </PremiumCard>
  );
};

// ============================================
// BUTTON VARIANTS
// ============================================
interface PremiumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
}

export const PremiumButton = forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ 
    children, 
    className, 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    disabled,
    ...props 
  }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantStyles = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 focus:ring-primary',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
      outline: 'border-2 border-border bg-transparent hover:bg-muted text-foreground focus:ring-primary',
      ghost: 'bg-transparent hover:bg-muted text-foreground focus:ring-primary',
      danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/25 focus:ring-destructive',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 focus:ring-emerald-600',
    };

    const sizeStyles = {
      sm: 'h-9 px-4 text-sm gap-2',
      md: 'h-11 px-6 text-sm gap-2',
      lg: 'h-14 px-8 text-base gap-3',
      icon: 'h-10 w-10',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon className="h-4 w-4" />}
            {children}
            {Icon && iconPosition === 'right' && <Icon className="h-4 w-4" />}
          </>
        )}
      </button>
    );
  }
);
PremiumButton.displayName = 'PremiumButton';

// ============================================
// SECTION HEADER
// ============================================
interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: ReactNode;
  badge?: string;
}

export const SectionHeader = ({ 
  title, 
  description, 
  icon: Icon, 
  iconColor = 'text-primary',
  action,
  badge,
}: SectionHeaderProps) => (
  <div className="flex items-start justify-between mb-4">
    <div className="flex items-center gap-2">
      {Icon && (
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ============================================
// PAGE HEADER
// ============================================
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
}

export const PageHeader = ({
  title,
  subtitle,
  breadcrumbs,
  primaryAction,
  secondaryActions,
}: PageHeaderProps) => (
  <div className="mb-8">
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span>/</span>}
            {crumb.href ? (
              <a href={crumb.href} className="hover:text-primary transition-colors">
                {crumb.label}
              </a>
            ) : (
              <span className="text-foreground font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
    )}
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {secondaryActions}
        {primaryAction}
      </div>
    </div>
  </div>
);

// ============================================
// EMPTY STATE
// ============================================
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    {Icon && (
      <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
    )}
    <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
    {description && <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>}
    {action}
  </div>
);

// ============================================
// STATUS BADGE
// ============================================
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  label: string;
  dot?: boolean;
}

export const StatusBadge = ({ status, label, dot = true }: StatusBadgeProps) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const dotStyles = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-slate-400',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
      styles[status]
    )}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[status])} />}
      {label}
    </span>
  );
};

// ============================================
// QUICK ACTION BUTTON
// ============================================
interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

export const QuickAction = ({ 
  icon: Icon, 
  label, 
  description, 
  onClick, 
  color = 'from-primary to-teal',
  disabled = false,
}: QuickActionProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-card',
      'hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20',
      'transition-all duration-200 w-full text-center group',
      disabled && 'opacity-50 cursor-not-allowed hover:shadow-none hover:translate-y-0'
    )}
  >
    <div className={cn('h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center', color)}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div>
      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
    </div>
  </button>
);

// ============================================
// LOADING SKELETON
// ============================================
export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('bg-card rounded-2xl border border-border/50 p-6 animate-pulse', className)}>
    <div className="h-12 w-12 bg-muted rounded-2xl mb-4" />
    <div className="h-8 w-24 bg-muted rounded-lg mb-2" />
    <div className="h-4 w-32 bg-muted rounded-md" />
  </div>
);

export const SkeletonList = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50 animate-pulse">
        <div className="h-10 w-10 bg-muted rounded-xl" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-muted rounded-md mb-2" />
          <div className="h-3 w-24 bg-muted rounded-md" />
        </div>
      </div>
    ))}
  </div>
);
