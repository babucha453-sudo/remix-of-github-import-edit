/**
 * Premium Dentist Dashboard Top Bar
 * Sticky header with search, notifications, and quick actions
 * Professional glassmorphism design with modern aesthetics
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Bell,
  Calendar,
  MessageSquare,
  Star,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Check,
  User,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

interface DentistTopBarProps {
  pageTitle: string;
  pageDescription?: string;
  breadcrumbs?: { label: string; onClick?: () => void }[];
}

export default function DentistTopBar({
  pageTitle,
  pageDescription,
  breadcrumbs,
}: DentistTopBarProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch clinic for context
  const { data: clinic } = useQuery({
    queryKey: ['topbar-clinic', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['topbar-notifications', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('booking_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Mark notification as read
  const markAsRead = async (id: string) => {
    await supabase
      .from('booking_notifications')
      .update({ is_read: true })
      .eq('id', id);
  };

  // Notification type configs
  const notificationIcons = {
    appointment: { icon: Calendar, color: 'text-primary bg-primary/10' },
    review: { icon: Star, color: 'text-amber-500 bg-amber-50' },
    message: { icon: MessageSquare, color: 'text-blue-500 bg-blue-50' },
    alert: { icon: AlertCircle, color: 'text-red-500 bg-red-50' },
  };

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left side - Breadcrumbs & Title */}
        <div className="flex-1 min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-0.5">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-border">/</span>}
                  {crumb.onClick ? (
                    <button
                      onClick={crumb.onClick}
                      className="hover:text-primary transition-colors"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-foreground font-medium">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-teal" />
            <div>
              <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
              {pageDescription && (
                <p className="text-xs text-muted-foreground">{pageDescription}</p>
              )}
            </div>
          </div>
        </div>

        {/* Center - Search */}
        <div className="hidden lg:flex items-center max-w-md flex-1 mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients, appointments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-3">
          {/* Date Display */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{format(new Date(), 'EEE, MMM d')}</span>
          </div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-xl hover:bg-muted"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl p-0">
              <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 border-b">
                <span className="font-semibold">Notifications</span>
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {notifications.length} new
                  </Badge>
                )}
              </DropdownMenuLabel>
              
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No new notifications</p>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.map((notification) => {
                    const type = (notification.notification_type as keyof typeof notificationIcons) || 'alert';
                    const config = notificationIcons[type] || notificationIcons.alert;
                    const Icon = config.icon;
                    
                    return (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex items-start gap-3 p-4 cursor-pointer focus:bg-muted"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', config.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              )}
              
              <DropdownMenuSeparator />
              <div className="p-2">
                <Button variant="ghost" size="sm" className="w-full justify-center text-primary">
                  View all notifications
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl hover:bg-muted"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
