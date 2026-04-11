import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CommandAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'teal' | 'gold' | 'coral';
  badge?: string;
}

interface CommandStripProps {
  actions: CommandAction[];
  className?: string;
}

const variantClasses = {
  default: 'bg-card hover:bg-muted border-border text-foreground',
  primary: 'bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary',
  teal: 'bg-teal/10 hover:bg-teal/20 border-teal/30 text-teal',
  gold: 'bg-gold/10 hover:bg-gold/20 border-gold/30 text-gold',
  coral: 'bg-coral/10 hover:bg-coral/20 border-coral/30 text-coral',
};

export default function CommandStrip({ actions, className }: CommandStripProps) {
  return (
    <TooltipProvider>
      <div className={cn(
        'sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border -mx-6 px-6 py-3',
        className
      )}>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const variant = action.variant || 'default';
            
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={cn(
                      'relative flex items-center gap-2 rounded-full px-4 py-2 h-auto border transition-all duration-200 whitespace-nowrap font-semibold text-sm',
                      variantClasses[variant],
                      action.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{action.label}</span>
                    {action.badge && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-coral text-white text-[10px] font-bold flex items-center justify-center">
                        {action.badge}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
