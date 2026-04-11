/**
 * New Dentist Top Bar V3
 * Clean, minimal header with notifications
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
  ChevronRight,
  User,
  Settings,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface DentistTopBarV3Props {
  pageTitle: string;
  pageDescription?: string;
}

export default function DentistTopBarV3({
  pageTitle,
  pageDescription,
}: DentistTopBarV3Props) {
  const { user, signOut, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch clinic for context
  const { data: clinic } = useQuery({
    queryKey: ['topbar-v3-clinic', user?.id],
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
    queryKey: ['topbar-v3-notifications', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('booking_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5);
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

  const unreadCount = notifications.length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment': return { icon: Calendar, color: 'text-indigo-600 bg-indigo-100' };
      case 'review': return { icon: Star, color: 'text-amber-600 bg-amber-100' };
      case 'message': return { icon: MessageSquare, color: 'text-blue-600 bg-blue-100' };
      default: return { icon: AlertCircle, color: 'text-red-600 bg-red-100' };
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      {/* Left - Page Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
        {pageDescription && (
          <p className="text-sm text-gray-500">{pageDescription}</p>
        )}
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 pl-9 h-9 rounded-lg bg-gray-50 border-gray-200 text-sm focus:bg-white"
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-lg">
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge className="bg-red-100 text-red-700">{unreadCount} new</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">
                No new notifications
              </div>
            ) : (
              notifications.slice(0, 5).map((notif: any) => {
                const { icon: Icon, color } = getNotificationIcon(notif.type || 'alert');
                return (
                  <DropdownMenuItem key={notif.id} className="flex items-start gap-3 p-3">
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{notif.title}</p>
                      <p className="text-xs text-gray-500 truncate">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{format(new Date(notif.created_at), 'MMM d, h:mm a')}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center text-indigo-600 font-medium">
                  View all notifications
                  <ChevronRight className="h-4 w-4 ml-1" />
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 rounded-lg px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm font-semibold">
                  {clinic?.name?.charAt(0) || 'D'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-gray-700 hidden md:block">
                {clinic?.name || 'Dentist'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{clinic?.name || 'Your Practice'}</span>
                <span className="text-xs text-gray-500 font-normal">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HelpCircle className="h-4 w-4 mr-2" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
