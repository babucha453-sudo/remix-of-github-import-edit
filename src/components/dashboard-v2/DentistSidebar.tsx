/**
 * Premium Dentist Dashboard Sidebar
 * Compact, visually appealing sidebar with theme colors and glassmorphism
 */

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
  ChevronRight,
  LogOut,
  Sparkles,
  TrendingUp,
  Image,
  BarChart3,
  Megaphone,
  Search,
} from 'lucide-react';

// Navigation structure
const NAV_SECTIONS = [
  {
    title: 'Dashboard',
    items: [
      { id: 'my-dashboard', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    title: 'My Practice',
    items: [
      { id: 'my-practice', label: 'Practice Info', icon: Building2 },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'my-appointments', label: 'Appointments', icon: Calendar, showBadge: true },
      { id: 'my-availability', label: 'Availability', icon: Clock },
      { id: 'my-appointment-types', label: 'Appointment Types', icon: Stethoscope },
      { id: 'my-patients', label: 'Patients', icon: Users },
      { id: 'my-messages', label: 'Messages', icon: Inbox },
      { id: 'my-intake-forms', label: 'Intake Forms', icon: ClipboardList },
      { id: 'my-form-workflows', label: 'Form Automation', icon: Zap, badge: 'AI' },
      { id: 'my-operations', label: 'Automation', icon: Zap },
    ],
  },
  {
    title: 'Profile',
    items: [
      { id: 'my-profile', label: 'Edit Profile', icon: Building2 },
      { id: 'my-team', label: 'Team', icon: UserCog },
      { id: 'my-services', label: 'Treatments', icon: Stethoscope },
      { id: 'my-insurance', label: 'Insurance', icon: Shield },
    ],
  },
  {
    title: 'Gallery',
    items: [
      { id: 'my-gallery', label: 'Before & After', icon: Image, badge: 'New' },
      { id: 'my-platform-reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    title: 'Reputation',
    items: [
      { id: 'my-reputation', label: 'Reputation Suite', icon: Star, badge: 'PRO' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { id: 'my-templates', label: 'Templates', icon: FileText },
      { id: 'my-notifications', label: 'Notifications', icon: Inbox },
    ],
  },
  {
    title: 'Growth',
    items: [
      { id: 'my-analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'my-marketing', label: 'Marketing', icon: Megaphone },
      { id: 'my-seo', label: 'SEO', icon: Search },
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

interface DentistSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function DentistSidebar({
  activeTab,
  onTabChange,
  collapsed,
  onCollapsedChange,
}: DentistSidebarProps) {
  const { user, signOut } = useAuth();

  // Fetch clinic data
  const { data: clinic } = useQuery({
    queryKey: ['sidebar-clinic', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug, cover_image_url, verification_status, rating, review_count')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch pending appointments count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['sidebar-pending-count', clinic?.id],
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

  const NavItem = ({ item }: { item: typeof NAV_SECTIONS[0]['items'][0] }) => {
    const isActive = activeTab === item.id;
    const Icon = item.icon;
    const showBadgeCount = item.showBadge && pendingCount > 0;

    const content = (
      <button
        onClick={() => onTabChange(item.id)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
          'text-[13px] font-semibold relative group overflow-hidden',
          isActive
            ? 'bg-gradient-to-r from-primary via-primary to-teal text-white shadow-lg shadow-primary/30'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80',
          collapsed && 'justify-center px-2'
        )}
      >
        {/* Active background glow */}
        {isActive && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        
        <Icon className={cn(
          'h-4 w-4 flex-shrink-0 relative z-10 transition-colors',
          isActive ? 'text-white' : 'text-slate-500 group-hover:text-primary'
        )} />
        
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate relative z-10">{item.label}</span>
            
            {showBadgeCount && (
              <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-bold bg-coral text-white border-0 relative z-10 animate-pulse">
                {pendingCount > 9 ? '9+' : pendingCount}
              </Badge>
            )}
            
            {item.badge === 'AI' && (
              <Badge className="h-4.5 px-1.5 text-[9px] font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0 relative z-10">
                AI
              </Badge>
            )}
            {item.badge === 'PRO' && (
              <Badge className="h-4.5 px-1.5 text-[9px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 relative z-10">
                PRO
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
            <TooltipContent side="right" className="flex items-center gap-2 bg-slate-900 text-white border-slate-700">
              {item.label}
              {showBadgeCount && (
                <Badge className="h-4 min-w-4 px-1 text-[9px] bg-coral text-white border-0">
                  {pendingCount}
                </Badge>
              )}
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
        'fixed inset-y-0 left-0 z-50 flex flex-col',
        'bg-white border-r border-slate-200 shadow-sm',
        'transition-all duration-300 ease-out',
        collapsed ? 'w-[60px]' : 'w-56'
      )}
    >
      {/* Logo & Brand */}
      <div className={cn(
        'h-14 flex items-center gap-2 px-3 border-b border-slate-100',
        collapsed && 'justify-center'
      )}>
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-sm flex-shrink-0">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm text-slate-800">AppointPanda</span>
        )}
      </div>

      {/* Clinic Card - Compact */}
      {!collapsed && clinic && (
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100">
            <Avatar className="h-8 w-8 rounded-lg border border-slate-200">
              <AvatarImage src={clinic.cover_image_url || undefined} />
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold text-xs">
                {clinic.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{clinic.name}</p>
              <div className="flex items-center gap-1">
                {clinic.verification_status === 'verified' && (
                  <Badge variant="outline" className="h-3 px-1 text-[8px] bg-emerald-50 text-emerald-600 border-emerald-200">
                    ✓
                  </Badge>
                )}
                {(clinic.rating || 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {Number(clinic.rating).toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2">
        <nav className="space-y-4 py-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer - Collapse + User */}
      <div className="border-t border-slate-100">
        {/* Collapse Toggle - Compact */}
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors text-xs',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
        
        {/* User + Sign Out - Compact */}
        <div className={cn('p-2 border-t border-slate-100', collapsed && 'flex flex-col items-center')}>
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
            <Avatar className={cn('h-7 w-7 border border-slate-200')}>
              <AvatarFallback className="bg-slate-100 text-slate-600 font-medium text-xs">
                {user?.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {user?.email?.split('@')[0]}
                </p>
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className={cn(
              'mt-1 text-coral hover:text-coral hover:bg-coral/10 h-7 text-xs',
              collapsed ? 'w-7 p-0' : 'w-full justify-start gap-1.5'
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
