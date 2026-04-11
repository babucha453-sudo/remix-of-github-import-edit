import { useState, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  Inbox,
  FileText,
  Zap,
  Building2,
  Stethoscope,
  Shield,
  Star,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Bell,
  Search,
  Menu,
  X,
  UserCog,
  ClipboardList,
  BarChart3,
  Megaphone,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Define navigation structure
const NAV_SECTIONS = [
  {
    title: 'Dashboard',
    items: [
      { id: 'my-dashboard', label: 'Overview', icon: LayoutDashboard, badge: null },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'my-appointments', label: 'Appointments', icon: Calendar, badge: 'live' },
      { id: 'my-availability', label: 'Availability', icon: Clock, badge: null },
      { id: 'my-appointment-types', label: 'Services', icon: Stethoscope, badge: null },
      { id: 'my-patients', label: 'Patients', icon: Users, badge: null },
      { id: 'my-messages', label: 'Messages', icon: Inbox, badge: null },
      { id: 'my-intake-forms', label: 'Intake Forms', icon: ClipboardList, badge: null },
      { id: 'my-operations', label: 'Automation', icon: Zap, badge: 'ai' },
    ],
  },
  {
    title: 'Profile',
    items: [
      { id: 'my-profile', label: 'Edit Profile', icon: Building2, badge: null },
      { id: 'my-team', label: 'Team', icon: UserCog, badge: null },
      { id: 'my-services', label: 'Treatments', icon: Stethoscope, badge: null },
      { id: 'my-insurance', label: 'Insurance', icon: Shield, badge: null },
      { id: 'my-templates', label: 'Templates', icon: FileText, badge: null },
    ],
  },
  {
    title: 'Growth',
    items: [
      { id: 'my-analytics', label: 'Analytics', icon: BarChart3, badge: null },
      { id: 'my-marketing', label: 'Marketing', icon: Megaphone, badge: null },
      { id: 'my-seo', label: 'SEO', icon: Search, badge: null },
      { id: 'my-reputation', label: 'Reputation Suite', icon: Star, badge: 'pro' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'my-settings', label: 'Settings', icon: Settings, badge: null },
      { id: 'my-support', label: 'Support', icon: HelpCircle, badge: null },
    ],
  },
];

interface DentistDashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function DentistDashboardLayout({
  children,
  activeTab,
  onTabChange,
}: DentistDashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch clinic data
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-layout', user?.id],
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
    queryKey: ['pending-appointments-count', clinic?.id],
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

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const renderBadge = (badge: string | null, itemId: string) => {
    if (itemId === 'my-appointments' && pendingCount > 0) {
      return (
        <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold bg-coral text-white border-0">
          {pendingCount}
        </Badge>
      );
    }
    
    if (!badge) return null;
    
    if (badge === 'live') {
      return (
        <span className="ml-auto flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      );
    }
    
    if (badge === 'ai') {
      return (
        <Badge className="ml-auto h-5 px-1.5 text-[10px] font-medium bg-gradient-to-r from-purple to-indigo text-white border-0">
          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
          AI
        </Badge>
      );
    }
    
    if (badge === 'pro') {
      return (
        <Badge className="ml-auto h-5 px-1.5 text-[10px] font-medium bg-gradient-to-r from-gold to-amber-500 text-white border-0">
          PRO
        </Badge>
      );
    }
    
    return null;
  };

  const Sidebar = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div
      className={cn(
        'flex flex-col h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950',
        isMobile ? 'w-full' : collapsed ? 'w-[72px]' : 'w-64',
        'transition-all duration-300 ease-in-out'
      )}
    >
      {/* Logo Header */}
      <div className={cn(
        'flex items-center gap-3 p-4 border-b border-white/5',
        collapsed && !isMobile && 'justify-center'
      )}>
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg shadow-primary/25">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-white truncate">Practice Hub</h1>
            <p className="text-[10px] text-white/50 truncate">AI-Powered Dashboard</p>
          </div>
        )}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Clinic Card */}
      {(!collapsed || isMobile) && (
        <div className="p-4">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            {clinicLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 bg-white/10" />
                  <Skeleton className="h-3 w-16 mt-1 bg-white/10" />
                </div>
              </div>
            ) : clinic ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-lg border-2 border-primary/30">
                  <AvatarImage src={clinic.cover_image_url || undefined} />
                  <AvatarFallback className="rounded-lg bg-primary/20 text-primary font-bold">
                    {clinic.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{clinic.name}</p>
                  <div className="flex items-center gap-2">
                    {clinic.verification_status === 'verified' && (
                      <Badge className="h-4 px-1 text-[9px] bg-emerald-500/20 text-emerald-400 border-0">
                        Verified
                      </Badge>
                    )}
                    {(clinic.rating || 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-white/60">
                        <Star className="h-2.5 w-2.5 fill-gold text-gold" />
                        {Number(clinic.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/50 text-center py-2">No clinic linked</p>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-6 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {(!collapsed || isMobile) && (
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        if (isMobile) setMobileMenuOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                        'text-sm font-medium',
                        isActive
                          ? 'bg-gradient-to-r from-primary/20 to-teal/10 text-white shadow-lg shadow-primary/10 border border-primary/20'
                          : 'text-white/60 hover:text-white hover:bg-white/5',
                        collapsed && !isMobile && 'justify-center px-2'
                      )}
                      title={collapsed && !isMobile ? item.label : undefined}
                    >
                      <Icon className={cn(
                        'h-4.5 w-4.5 flex-shrink-0',
                        isActive ? 'text-primary' : ''
                      )} />
                      {(!collapsed || isMobile) && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {renderBadge(item.badge, item.id)}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse Toggle (Desktop only) */}
      {!isMobile && (
        <div className="p-3 border-t border-white/5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'w-full text-white/40 hover:text-white hover:bg-white/5',
              collapsed ? 'justify-center' : 'justify-start gap-2'
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
          </Button>
        </div>
      )}

      {/* User Footer */}
      <div className={cn(
        'p-4 border-t border-white/5',
        collapsed && !isMobile && 'flex justify-center'
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white/5 transition-colors',
              collapsed && !isMobile && 'justify-center'
            )}>
              <Avatar className="h-9 w-9 border-2 border-primary/30">
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {(!collapsed || isMobile) && (
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-white/50">Dentist Account</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-700">
            <DropdownMenuItem
              onClick={() => onTabChange('my-settings')}
              className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-coral hover:text-coral hover:bg-coral/10 cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-teal flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold text-white">Practice Hub</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <Bell className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 animate-in slide-in-from-left duration-300">
            <Sidebar isMobile />
          </div>
        </div>
      )}

      <div className="flex h-screen lg:h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block flex-shrink-0 h-full">
          <Sidebar />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {/* Desktop Header */}
          <header className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  placeholder="Search patients, appointments..."
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-primary/50 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="relative text-white/60 hover:text-white hover:bg-white/10"
              >
                <Bell className="h-5 w-5" />
                {pendingCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-coral" />
                )}
              </Button>
            </div>
          </header>

          {/* Content Area */}
          <ScrollArea className="h-[calc(100vh-65px)] lg:h-[calc(100vh-73px)]">
            <div className="p-4 lg:p-6">
              {children}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
