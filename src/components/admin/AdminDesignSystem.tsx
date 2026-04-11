/**
 * Admin Dashboard Design System
 * Professional, compact, data-dense design for platform management
 */

import { ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowRight, Loader2, Search, Bell, Settings, Menu, X, ChevronDown, ChevronRight, LayoutGrid, List, Filter, Plus, RefreshCw, Download, Upload, MoreHorizontal, Check, AlertTriangle, Info, XCircle } from 'lucide-react';

// ============================================
// DESIGN TOKENS
// ============================================
export const adminDesign = {
  colors: {
    primary: 'bg-gradient-to-r from-indigo-600 to-violet-600',
    primaryBg: 'bg-indigo-50 dark:bg-indigo-950',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  radius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  },
  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    none: 'shadow-none',
  },
  sizes: {
    sidebar: {
      expanded: 'w-64',
      collapsed: 'w-16',
      mobile: 'w-full',
    },
    header: 'h-14',
  },
  spacing: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-6',
  },
  transition: 'all duration-200 ease-in-out',
};

// ============================================
// BASE CARD COMPONENT
// ============================================
interface AdminCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'bordered' | 'solid' | 'highlight';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

export const AdminCard = forwardRef<HTMLDivElement, AdminCardProps>(
  ({ children, className, variant = 'default', padding = 'md', hover = false, onClick }, ref) => {
    const variantStyles = {
      default: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
      glass: 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50',
      bordered: 'bg-transparent border-2 border-slate-200 dark:border-slate-700',
      solid: 'bg-slate-900 dark:bg-slate-950 text-white',
      highlight: 'bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border border-indigo-200 dark:border-indigo-800',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    const hoverStyles = hover
      ? 'cursor-pointer hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200'
      : '';

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          'rounded-xl',
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles,
          className
        )}
      >
        {children}
      </div>
    );
  }
);
AdminCard.displayName = 'AdminCard';

// ============================================
// STATS CARD
// ============================================
interface AdminStatsCardProps {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
  loading?: boolean;
}

export const AdminStatsCard = ({ label, value, change, trend = 'neutral', icon: Icon, iconColor = 'text-indigo-600', className, loading }: AdminStatsCardProps) => {
  const trendColors = {
    up: 'text-emerald-600 bg-emerald-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-slate-500 bg-slate-50',
  };

  if (loading) {
    return (
      <AdminCard className={className}>
        <div className="animate-pulse flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1">
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </AdminCard>
    );
  }

  return (
    <AdminCard hover className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', iconColor, 'bg-opacity-10')}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        </div>
        {change !== undefined && (
          <div className={cn('px-2 py-1 rounded-full text-xs font-semibold', trendColors[trend])}>
            {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}{change}%
          </div>
        )}
      </div>
    </AdminCard>
  );
};

// ============================================
// BUTTON VARIANTS
// ============================================
interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const AdminButton = forwardRef<HTMLButtonElement, AdminButtonProps>(
  ({ children, variant = 'primary', size = 'md', icon: Icon, iconPosition = 'left', loading, className, disabled, ...props }, ref) => {
    const variantStyles = {
      primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200',
      secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white',
      outline: 'border border-slate-300 hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:hover:bg-slate-800 dark:text-slate-300',
      ghost: 'hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-300',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200',
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
      lg: 'h-10 px-5 text-base gap-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
          variantStyles[variant],
          sizeStyles[size],
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          className
        )}
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
AdminButton.displayName = 'AdminButton';

// ============================================
// INPUT COMPONENTS
// ============================================
interface AdminInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
}

export const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(
  ({ label, error, icon: Icon, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200',
              Icon && 'pl-10',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
AdminInput.displayName = 'AdminInput';

// ============================================
// BADGE COMPONENTS
// ============================================
interface AdminBadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export const AdminBadge = ({ children, variant = 'default', size = 'sm', className }: AdminBadgeProps) => {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    outline: 'bg-transparent border border-slate-300 text-slate-600 dark:text-slate-400',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span className={cn('inline-flex items-center font-medium rounded-full', variantStyles[variant], sizeStyles[size], className)}>
      {children}
    </span>
  );
};

// ============================================
// TABS COMPONENT
// ============================================
interface AdminTabsProps {
  tabs: { id: string; label: string; icon?: LucideIcon; count?: number }[];
  activeTab: string;
  onChange: (tab: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
}

export const AdminTabs = ({ tabs, activeTab, onChange, variant = 'default', size = 'md', className }: AdminTabsProps) => {
  const variantStyles = {
    default: 'bg-slate-100 dark:bg-slate-800 p-1 rounded-lg',
    pills: '',
    underline: 'border-b border-slate-200 dark:border-slate-700',
  };

  const tabStyles = {
    default: {
      base: 'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
      active: 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm',
      inactive: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
    },
    pills: {
      base: 'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
      active: 'bg-indigo-600 text-white',
      inactive: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
    },
    underline: {
      base: 'px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 -mb-px',
      active: 'border-indigo-600 text-indigo-600',
      inactive: 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
    },
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1', variantStyles[variant], className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              tabStyles[variant].base,
              isActive ? tabStyles[variant].active : tabStyles[variant].inactive,
              'inline-flex items-center gap-2'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-semibold', isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ============================================
// TABLE COMPONENTS
// ============================================
interface AdminTableProps {
  children: ReactNode;
  className?: string;
  loading?: boolean;
}

export const AdminTable = ({ children, className, loading }: AdminTableProps) => {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {children}
        </table>
      </div>
    </div>
  );
};

export const AdminTableHead = ({ children, className }: { children: ReactNode; className?: string }) => (
  <thead className={cn('bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700', className)}>
    {children}
  </thead>
);

export const AdminTableBody = ({ children, className }: { children: ReactNode; className?: string }) => (
  <tbody className={cn('divide-y divide-slate-200 dark:divide-slate-700', className)}>
    {children}
  </tbody>
);

export const AdminTableRow = ({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => (
  <tr className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors', onClick && 'cursor-pointer', className)} onClick={onClick}>
    {children}
  </tr>
);

export const AdminTableCell = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={cn('px-4 py-3 text-sm text-slate-700 dark:text-slate-300', className)}>
    {children}
  </td>
);

export const AdminTableHeaderCell = ({ children, className }: { children: ReactNode; className?: string }) => (
  <th className={cn('px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider', className)}>
    {children}
  </th>
);

// ============================================
// EMPTY STATE
// ============================================
interface AdminEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const AdminEmptyState = ({ icon: Icon, title, description, action, className }: AdminEmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
    {Icon && (
      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
    )}
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
    {description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm">{description}</p>}
    {action}
  </div>
);

// ============================================
// LOADING STATE
// ============================================
interface AdminLoadingProps {
  text?: string;
  className?: string;
}

export const AdminLoading = ({ text = 'Loading...', className }: AdminLoadingProps) => (
  <div className={cn('flex flex-col items-center justify-center py-12', className)}>
    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
    <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
  </div>
);

// ============================================
// AVATAR COMPONENT
// ============================================
interface AdminAvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AdminAvatar = ({ src, name, size = 'md', className }: AdminAvatarProps) => {
  const sizeStyles = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizeStyles[size], className)}
      />
    );
  }

  return (
    <div className={cn('rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-semibold text-white', sizeStyles[size], className)}>
      {initials}
    </div>
  );
};

// ============================================
// DROPDOWN MENU
// ============================================
interface AdminDropdownItemProps {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export const AdminDropdownItem = ({ icon: Icon, children, onClick, danger, disabled }: AdminDropdownItemProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg transition-colors',
      danger
        ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
      disabled && 'opacity-50 cursor-not-allowed'
    )}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
  </button>
);

// ============================================
// PROGRESS BAR
// ============================================
interface AdminProgressProps {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export const AdminProgress = ({ value, max = 100, variant = 'default', size = 'md', showLabel = false, className }: AdminProgressProps) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const variantColors = {
    default: 'bg-indigo-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };

  const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden', sizeStyles[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-300', variantColors[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{Math.round(percentage)}%</p>
      )}
    </div>
  );
};

// ============================================
// PAGINATION
// ============================================
interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const AdminPagination = ({ currentPage, totalPages, onPageChange, className }: AdminPaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <div className={cn('flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700', className)}>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <AdminButton
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </AdminButton>
        <AdminButton
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </AdminButton>
      </div>
    </div>
  );
};

// ============================================
// SEARCH INPUT
// ============================================
interface AdminSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const AdminSearch = ({ value, onChange, placeholder = 'Search...', className }: AdminSearchProps) => (
  <div className={cn('relative', className)}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 pl-10 pr-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    />
  </div>
);

// ============================================
// ALERT COMPONENTS
// ============================================
interface AdminAlertProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  title?: string;
  children: ReactNode;
  className?: string;
}

export const AdminAlert = ({ variant = 'default', title, children, className }: AdminAlertProps) => {
  const variantStyles = {
    default: 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700',
    success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    danger: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
  };

  const iconMap = {
    default: Info,
    success: Check,
    warning: AlertTriangle,
    danger: XCircle,
    info: Info,
  };

  const Icon = iconMap[variant];

  return (
    <div className={cn('flex gap-3 p-4 rounded-lg border', variantStyles[variant], className)}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
      <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};

// ============================================
// TOOLTIP WRAPPER
// ============================================
interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const AdminTooltip = ({ content, children, side = 'top' }: TooltipProps) => (
  <div className="relative group inline-block">
    {children}
    <div className={cn(
      'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
      side === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-2',
      side === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-2',
      side === 'left' && 'right-full top-1/2 -translate-y-1/2 mr-2',
      side === 'right' && 'left-full top-1/2 -translate-y-1/2 ml-2'
    )}>
      {content}
    </div>
  </div>
);
