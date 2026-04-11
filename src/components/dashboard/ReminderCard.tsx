import { LucideIcon, Calendar, Clock, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReminderCardProps {
  title: string;
  subtitle?: string;
  time?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function ReminderCard({
  title,
  subtitle,
  time,
  icon: Icon = Calendar,
  actionLabel = 'View Details',
  onAction,
  className,
}: ReminderCardProps) {
  return (
    <div className={cn(
      'bg-card rounded-2xl border border-border/50 p-5 overflow-hidden',
      className
    )}>
      <h3 className="font-bold text-foreground mb-4">Reminders</h3>
      
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{title}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {time && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Time: {time}</span>
          </div>
        )}

        {onAction && (
          <Button 
            onClick={onAction}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl"
          >
            <Video className="h-4 w-4 mr-2" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
