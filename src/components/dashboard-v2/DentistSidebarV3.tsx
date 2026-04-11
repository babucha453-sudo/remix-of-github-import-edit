/**
 * New Dentist Sidebar V3
 * Clean, minimal sidebar with bold accents
 * New visual design with improved UX
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  Clock,
  Stethoscope,
  Users,
  Inbox,
  ClipboardList,
  Zap,
  UserCog,
  Shield,
  Star,
  FileText,
  Settings,
  HelpCircle,
  ChevronLeft,
  LogOut,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

// Navigation structure - Clean categories
const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { id: 'my-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Practice',
    items: [
      { id: 'my-practice', label: 'Practice Info', icon: Building2 },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'my-appointments', label: 'Appointments', icon: Calendar, showBadge: true },
      { id: 'my-availability', label: 'Availability', icon: Clock },
      { id: 'my-appointment-types', label: 'Services', icon: Stethoscope },
      { id: 'my-patients', label: 'Patients', icon: Users },
      { id: 'my-messages', label: 'Messages', icon: Inbox },
      { id: 'my-intake-forms', label: 'Forms', icon: ClipboardList },
      { id: 'my-operations', label: 'Automation', icon: Zap },
    ],
  },
  {
    title: 'Profile',
    items: [
      { id: 'my-profile', label: 'Edit Profile', icon: Building2 },
      { id: 'my-team', label: 'Team', icon: UserCog },
      { id: 'my-insurance', label: 'Insurance', icon: Shield },
    ],
  },
  {
    title: 'Growth',
    items: [
      { id: 'my-reputation', label: 'Reputation', icon: Star, badge: 'PRO' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'my-settings', label: 'Settings', icon: Settings },
      { id: 'my-support', label: 'Support', icon: HelpCircle },
    ],
  },
];

interface DentistSidebarV3Props {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function DentistSidebarV3({
  activeTab,
  onTabChange,
  collapsed,
  onCollapsedChange,
}: DentistSidebarV3Props) {
  const { user, signOut, profile } = useAuth();

  // Fetch clinic data
  const { data: clinic } = useQuery({
    queryKey: ['sidebar-v3-clinic', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug, cover_image_url, rating')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch pending appointments
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['sidebar-v3-pending', clinic?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id)
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!clinic?.id,
  });

  const NavItem = ({ item, sectionIndex }: { item: any; sectionIndex: number }) => {
    const isActive = activeTab === item.id;
    const Icon = item.icon;
    const showBadgeCount = item.showBadge && pendingCount > 0;

    const content = (
      <button
        onClick={() => onTabChange(item.id)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
          'text-sm font-medium relative',
          isActive
            ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
          collapsed && 'justify-center px-2'
        )}
      >
        <Icon className={cn(
          'h-4 w-4 flex-shrink-0',
          isActive ? 'text-white' : 'text-gray-500'
        )} />
        
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            
            {showBadgeCount && (
              <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-bold bg-red-500 text-white border-0">
                {pendingCount > 9 ? '9+' : pendingCount}
              </Badge>
            )}
            
            {item.badge && (
              <Badge className="h-5 px-1.5 text-[9px] font-bold bg-amber-500 text-white border-0">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </button>
    );

    if (collapsed) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
              {item.label}
              {showBadgeCount && <span className="ml-2 text-gray-400">({pendingCount})</span>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-50',
        'flex flex-col transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo & Brand */}
      <div className={cn(
        'h-16 flex items-center border-b border-gray-100',
        collapsed ? 'justify-center px-2' : 'px-5 justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AP</span>
            </div>
            <span className="font-bold text-gray-900">DentistHub</span>
          </div>
        )}
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            'p-1.5 rounded-lg hover:bg-gray-100 transition-colors',
            collapsed && 'rotate-180'
          )}
        >
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* User Info - Compact */}
      {!collapsed && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm font-semibold">
                {clinic?.name?.charAt(0) || 'D'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{clinic?.name || 'Your Practice'}</p>
              <p className="text-xs text-gray-500 truncate">{profile?.email || user?.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <div className="space-y-6 px-3">
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavItem key={item.id} item={item} sectionIndex={sectionIndex} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className={cn(
        'border-t border-gray-100 py-3',
        collapsed ? 'px-2' : 'px-4'
      )}>
        {collapsed ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-gray-900 text-white border-gray-800">
                Sign Out
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-500 text-sm font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
