import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ModernCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'dark' | 'accent' | 'gradient';
  noPadding?: boolean;
}

export default function ModernCard({
  children,
  className,
  title,
  action,
  variant = 'default',
  noPadding = false,
}: ModernCardProps) {
  const variantClasses = {
    default: 'bg-card border border-border/50 shadow-sm',
    dark: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl',
    accent: 'bg-gradient-to-br from-primary/5 to-teal/5 border border-primary/10',
    gradient: 'bg-gradient-to-br from-primary to-teal text-white shadow-xl',
  };

  const isDark = variant === 'dark' || variant === 'gradient';

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden transition-all duration-200',
        variantClasses[variant],
        className
      )}
    >
      {(title || action) && (
        <div className={cn(
          'flex items-center justify-between',
          noPadding ? 'px-5 pt-5' : 'px-5 pt-5 pb-0'
        )}>
          {title && (
            <h3 className={cn(
              'text-lg font-bold',
              isDark ? 'text-white' : 'text-foreground'
            )}>
              {title}
            </h3>
          )}
          {action && (
            <Button 
              variant={isDark ? 'ghost' : 'outline'} 
              size="sm" 
              className={cn(
                'rounded-full text-xs font-medium',
                isDark && 'text-white hover:bg-white/10'
              )}
              onClick={action.onClick}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {action.label}
            </Button>
          )}
        </div>
      )}
      <div className={cn(!noPadding && 'p-5')}>
        {children}
      </div>
    </div>
  );
}
