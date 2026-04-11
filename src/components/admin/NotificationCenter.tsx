import { useState } from 'react';
import { 
  Bell, 
  CheckCheck, 
  X, 
  Calendar, 
  Star, 
  Shield, 
  CreditCard, 
  Key, 
  Search, 
  Settings, 
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDismissNotification,
  PlatformNotification,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const categoryIcons: Record<string, typeof Bell> = {
  appointment: Calendar,
  review: Star,
  claim: Shield,
  payment: CreditCard,
  oauth: Key,
  seo: Search,
  system: Settings,
  content: FileText,
  general: Bell,
};

const severityIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

const severityColors: Record<string, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  error: 'bg-red-50 border-red-200 text-red-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
};

export default function NotificationCenter() {
  const { data: notifications = [], isLoading } = useNotifications();
  const unreadCount = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const handleNotificationClick = (notification: PlatformNotification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    
    if (notification.action_url) {
      // SECURITY: Validate URL is internal only to prevent open redirect attacks
      try {
        const url = new URL(notification.action_url, window.location.origin);
        
        // Only allow same-origin URLs (relative paths or same domain)
        if (url.origin !== window.location.origin) {
          console.error('External redirect blocked:', notification.action_url);
          toast.error('Invalid notification link');
          return;
        }
        
        // Use only the path portion for safety
        window.location.href = url.pathname + url.search + url.hash;
      } catch {
        // Invalid URL format - could be a relative path
        if (notification.action_url.startsWith('/')) {
          window.location.href = notification.action_url;
        } else {
          console.error('Invalid notification URL format:', notification.action_url);
          toast.error('Invalid notification link');
        }
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-coral border-0"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs"
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        
        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="all" className="flex-1 rounded-none">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex-1 rounded-none">
              Unread ({unreadCount})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={filter} className="m-0">
            <ScrollArea className="h-96">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredNotifications.map((notification) => {
                    const CategoryIcon = categoryIcons[notification.category] || Bell;
                    const SeverityIcon = severityIcons[notification.severity] || Info;
                    
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          'p-4 hover:bg-muted/50 cursor-pointer transition-colors relative group',
                          !notification.is_read && 'bg-primary/5'
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border',
                            severityColors[notification.severity]
                          )}>
                            <SeverityIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn(
                                'text-sm',
                                !notification.is_read && 'font-semibold'
                              )}>
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-[10px] h-5">
                                <CategoryIcon className="h-3 w-3 mr-1" />
                                {notification.category}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            {notification.action_url && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs mt-2 h-7 px-2"
                              >
                                View details
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismiss.mutate(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
