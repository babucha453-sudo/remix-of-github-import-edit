import { LucideIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectItem {
  id: string;
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
}

interface ProjectListProps {
  title: string;
  items: ProjectItem[];
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function ProjectList({ title, items, action, className }: ProjectListProps) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    teal: 'bg-teal/10 text-teal',
    gold: 'bg-gold/10 text-gold',
    coral: 'bg-coral/10 text-coral',
    purple: 'bg-purple/10 text-purple',
    blue: 'bg-blue-custom/10 text-blue-custom',
    emerald: 'bg-emerald/10 text-emerald',
  };

  return (
    <div className={cn('bg-card rounded-2xl border border-border/50 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <h3 className="font-bold text-foreground">{title}</h3>
        {action && (
          <button 
            onClick={action.onClick}
            className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
          >
            {action.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-border/30">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={item.onClick}
            className={cn(
              'flex items-center gap-4 px-5 py-3.5 transition-colors',
              item.onClick && 'cursor-pointer hover:bg-muted/50'
            )}
          >
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
              colorMap[item.iconColor || 'primary']
            )}>
              <item.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
            </div>
            {item.onClick && (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
