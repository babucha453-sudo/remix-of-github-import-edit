import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon, ArrowRight, Zap } from 'lucide-react';

interface QuickActionsPanelProps {
  actions: Array<{
    icon: LucideIcon;
    label: string;
    description?: string;
    onClick: () => void;
    color?: 'primary' | 'teal' | 'gold' | 'coral' | 'purple' | 'blue';
    badge?: string;
    highlight?: boolean;
  }>;
  title?: string;
  columns?: 2 | 3 | 4;
}

export default function QuickActionsPanel({
  actions,
  title = 'Quick Actions',
  columns = 4,
}: QuickActionsPanelProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary hover:bg-primary/20',
    teal: 'bg-teal/10 text-teal hover:bg-teal/20',
    gold: 'bg-gold/10 text-gold hover:bg-gold/20',
    coral: 'bg-coral/10 text-coral hover:bg-coral/20',
    purple: 'bg-purple/10 text-purple hover:bg-purple/20',
    blue: 'bg-blue-custom/10 text-blue-custom hover:bg-blue-custom/20',
  };

  const gridClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-4',
  };

  return (
    <Card className="card-modern">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid ${gridClasses[columns]} gap-3`}>
          {actions.map((action, index) => {
            const Icon = action.icon;
            const color = action.color || 'primary';
            
            return (
              <Button
                key={index}
                variant="ghost"
                className={`h-auto p-4 flex flex-col items-start gap-2 rounded-xl border border-border/50 transition-all ${
                  action.highlight 
                    ? 'bg-gradient-to-br from-primary/10 to-teal/10 border-primary/30 hover:border-primary/50' 
                    : 'hover:border-primary/30'
                }`}
                onClick={action.onClick}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {action.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {action.badge}
                    </Badge>
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{action.label}</p>
                  {action.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
