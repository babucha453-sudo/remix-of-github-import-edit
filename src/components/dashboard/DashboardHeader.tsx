import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Settings, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  clinicName?: string;
  verificationBadge?: 'verified' | 'pending' | 'unverified';
  planName?: string;
  notificationCount?: number;
  onNotificationClick?: () => void;
  onSettingsClick?: () => void;
  actions?: React.ReactNode;
}

export default function DashboardHeader({
  title,
  subtitle,
  clinicName,
  verificationBadge,
  planName,
  notificationCount = 0,
  onNotificationClick,
  onSettingsClick,
  actions,
}: DashboardHeaderProps) {
  const getBadgeClass = () => {
    switch (verificationBadge) {
      case 'verified':
        return 'bg-teal/10 text-teal border-teal/20';
      case 'pending':
        return 'bg-gold/10 text-gold border-gold/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            {title}
          </h1>
          {verificationBadge && (
            <Badge className={getBadgeClass()}>
              {verificationBadge === 'verified' ? '✓ Verified' : verificationBadge === 'pending' ? 'Pending' : 'Unverified'}
            </Badge>
          )}
          {planName && (
            <Badge variant="outline" className="bg-gold/10 text-gold border-gold/30 font-semibold">
              {planName}
            </Badge>
          )}
        </div>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        {clinicName && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {clinicName}
            <ChevronRight className="h-3 w-3" />
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        
        {onNotificationClick && (
          <Button
            variant="outline"
            size="icon"
            className="relative h-10 w-10 rounded-xl"
            onClick={onNotificationClick}
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-coral text-white text-xs font-bold flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </Button>
        )}
        
        {onSettingsClick && (
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={onSettingsClick}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
