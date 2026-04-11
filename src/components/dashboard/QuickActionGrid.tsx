import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  badge?: string;
  color?: 'primary' | 'teal' | 'gold' | 'coral' | 'purple';
}

interface QuickActionGridProps {
  actions: QuickAction[];
  className?: string;
}

export default function QuickActionGrid({ actions, className }: QuickActionGridProps) {
  const colorConfig = {
    primary: 'bg-primary/10 text-primary hover:bg-primary/15',
    teal: 'bg-teal/10 text-teal hover:bg-teal/15',
    gold: 'bg-gold/10 text-gold hover:bg-gold/15',
    coral: 'bg-coral/10 text-coral hover:bg-coral/15',
    purple: 'bg-purple/10 text-purple hover:bg-purple/15',
  };

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2', className)}>
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className={cn(
            'relative flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-card',
            'transition-all duration-200 hover:shadow-md hover:border-border hover:scale-[1.02]',
            'focus:outline-none focus:ring-2 focus:ring-primary/20'
          )}
        >
          <div className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center',
            colorConfig[action.color || 'primary']
          )}>
            <action.icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-foreground">{action.label}</span>
          {action.badge && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 rounded-full bg-coral text-white text-[10px] font-bold flex items-center justify-center">
              {action.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
