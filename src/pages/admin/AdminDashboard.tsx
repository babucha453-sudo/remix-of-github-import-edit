// Admin Dashboard - Main Entry Point
import { useState, useEffect, useMemo, Suspense } from 'react';
import { lazyRetry } from '@/utils/lazyRetry';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/router';
import { useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useBookingNotifications, useMarkNotificationRead } from '@/hooks/useAdminAppointments';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard,
  MapPin,
  Stethoscope,
  Building2,
  Shield,
  Users,
  Calendar,
  CalendarDays,
  UserPlus,
  FileText,
  BookOpen,
  Search,
  Bot,
  Lock,
  CreditCard,
  ClipboardList,
  Menu,
  X,
  LogOut,
  Globe,
  Mail,
  Settings,
  Palette,
  TrendingUp,
  MessageSquare,
  Target,
  Bell,
  ChevronRight,
  Phone,
  Inbox,
  Zap,
  Star,
  Flag,
  Activity,
  Clock,
  Sparkles,
  Database,
  RotateCcw,
  Layers,
  Command,
  Home,
  BarChart3,
  DollarSign,
  UserCheck,
  FileEdit,
  Megaphone,
  HeadphonesIcon,
  Keyboard,
  Workflow,
  AlertCircle,
  CheckCircle2,
  PanelLeftClose,
  PanelLeft,
  Eye,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Lazy-load ALL tab components for fast initial load (with retry for stale chunks)
const OverviewTab = lazyRetry(() => import('@/components/admin/tabs/OverviewTab'));
const LocationsTab = lazyRetry(() => import('@/components/admin/tabs/LocationsTab'));
const TreatmentsTab = lazyRetry(() => import('@/components/admin/tabs/TreatmentsTab'));
const ClinicsTab = lazyRetry(() => import('@/components/admin/tabs/ClinicsTab'));
const ClaimsTab = lazyRetry(() => import('@/components/admin/tabs/ClaimsTab'));
const UsersTab = lazyRetry(() => import('@/components/admin/tabs/UsersTab'));
const AppointmentsTab = lazyRetry(() => import('@/components/admin/tabs/AppointmentsTab'));
const LeadsTab = lazyRetry(() => import('@/components/admin/tabs/LeadsTab'));
const PagesTab = lazyRetry(() => import('@/components/admin/tabs/PagesTab'));
const BlogTab = lazyRetry(() => import('@/components/admin/tabs/BlogTab'));
const SeoTab = lazyRetry(() => import('@/components/admin/tabs/SeoTab'));
const AutomationTab = lazyRetry(() => import('@/components/admin/tabs/AutomationTab'));
const RolesTab = lazyRetry(() => import('@/components/admin/tabs/RolesTab'));
const SubscriptionsTab = lazyRetry(() => import('@/components/admin/tabs/SubscriptionsTab'));
const AuditLogsTab = lazyRetry(() => import('@/components/admin/tabs/AuditLogsTab'));
const GmbBridgeTab = lazyRetry(() => import('@/components/admin/tabs/GmbBridgeTab'));
const GmbScraperBotTab = lazyRetry(() => import('@/components/admin/tabs/GmbScraperBotTab'));
const OutreachTab = lazyRetry(() => import('@/components/admin/tabs/OutreachTab'));
const SettingsTab = lazyRetry(() => import('@/components/admin/tabs/SettingsTab'));
const SiteConfigTab = lazyRetry(() => import('@/components/admin/tabs/SiteConfigTab'));
const SmokeTestTab = lazyRetry(() => import('@/components/admin/tabs/SmokeTestTab'));
const RankingRulesTab = lazyRetry(() => import('@/components/admin/tabs/RankingRulesTab'));
const ReviewInsightsTab = lazyRetry(() => import('@/components/admin/tabs/ReviewInsightsTab'));
const LocationAuditTab = lazyRetry(() => import('@/components/admin/tabs/LocationAuditTab'));
const SeoCopilotTab = lazyRetry(() => import('@/components/admin/tabs/SeoCopilotTab'));
const CrmNumbersTab = lazyRetry(() => import('@/components/admin/tabs/CrmNumbersTab'));
const MessagingControlTab = lazyRetry(() => import('@/components/admin/tabs/MessagingControlTab'));
const PlansTab = lazyRetry(() => import('@/components/admin/tabs/PlansTab'));
const PromotionsTab = lazyRetry(() => import('@/components/admin/tabs/PromotionsTab'));
const FounderWeeklyTab = lazyRetry(() => import('@/components/admin/tabs/FounderWeeklyTab'));
const TopDentistsTab = lazyRetry(() => import('@/components/admin/tabs/TopDentistsTab'));
const PinnedProfilesTab = lazyRetry(() => import('@/components/admin/tabs/PinnedProfilesTab'));
const DentistDashboardTab = lazyRetry(() => import('@/components/admin/tabs/DentistDashboardTab'));
const ProfileEditorTab = lazyRetry(() => import('@/components/dentist/ProfileEditorTab'));
const ServicesTab = lazyRetry(() => import('@/components/dentist/ServicesTab'));
const DentistReviewsTab = lazyRetry(() => import('@/components/dentist/DentistReviewsTab'));
const DentistAppointmentsTab = lazyRetry(() => import('@/components/dentist/DentistAppointmentsTab'));
const PatientsTab = lazyRetry(() => import('@/components/dentist/PatientsTab'));
const MessagesTab = lazyRetry(() => import('@/components/dentist/MessagesTab'));
const OperationsTab = lazyRetry(() => import('@/components/dentist/OperationsTab'));
const ReviewRequestsTab = lazyRetry(() => import('@/components/dentist/ReviewRequestsTab'));
const ReputationGrowthTab = lazyRetry(() => import('@/components/dentist/ReputationGrowthTab'));
const DentistReputationHub = lazyRetry(() => import('@/components/reputation/DentistReputationHub'));
const AdminReputationHub = lazyRetry(() => import('@/components/reputation/AdminReputationHub'));
const SupportTicketsTab = lazyRetry(() => import('@/components/dentist/SupportTicketsTab'));
const TeamManagementTab = lazyRetry(() => import('@/components/dentist/TeamManagementTab'));
const DentistSettingsTab = lazyRetry(() => import('@/components/dentist/DentistSettingsTab'));
const TemplatesTab = lazyRetry(() => import('@/components/dentist/TemplatesTab'));
const InsuranceManagementTab = lazyRetry(() => import('@/components/dentist/InsuranceManagementTab'));
const IntakeFormsTab = lazyRetry(() => import('@/components/dentist/IntakeFormsTab'));
const AIControlsTab = lazyRetry(() => import('@/components/admin/tabs/AIControlsTab'));
const AISearchControlTab = lazyRetry(() => import('@/components/admin/tabs/AISearchControlTab').then(m => ({ default: m.AISearchControlTab })));
const ApiControlTab = lazyRetry(() => import('@/components/admin/tabs/ApiControlTab'));
const PlatformServicesTab = lazyRetry(() => import('@/components/admin/tabs/PlatformServicesTab'));
const SupportTicketsAdminTab = lazyRetry(() => import('@/components/admin/tabs/SupportTicketsAdminTab'));
const GMBConnectionsTab = lazyRetry(() => import('@/components/admin/tabs/GMBConnectionsTab'));
const ContactDetailsTab = lazyRetry(() => import('@/components/admin/tabs/ContactDetailsTab'));
const SeoBotTab = lazyRetry(() => import('@/components/admin/tabs/SeoBotTab'));
const SeoContentOptimizerTab = lazyRetry(() => import('@/components/admin/tabs/SeoContentOptimizerTab'));
const SeoExpertTab = lazyRetry(() => import('@/components/admin/tabs/SeoExpertTab'));
const SeoCommandCenterTab = lazyRetry(() => import('@/components/admin/tabs/SeoCommandCenterTab'));
const SeoOperationsCenterTab = lazyRetry(() => import('@/components/admin/tabs/SeoOperationsCenterTab'));
const ContentGenerationStudioTab = lazyRetry(() => import('@/components/admin/tabs/ContentGenerationStudioTab'));
const FAQGenerationStudioTab = lazyRetry(() => import('@/components/admin/tabs/FAQGenerationStudioTab'));
const ContentAuditBotTab = lazyRetry(() => import('@/components/admin/tabs/ContentAuditBotTab'));
const ContentHubTab = lazyRetry(() => import('@/components/admin/tabs/ContentHubTab'));
const BlogManagementTab = lazyRetry(() => import('@/components/admin/tabs/BlogManagementTab'));
const ContentAutomationTab = lazyRetry(() => import('@/components/admin/tabs/ContentAutomationTab'));
const Phase2SprintHubTab = lazyRetry(() => import('@/components/admin/tabs/Phase2SprintHubTab'));
const Phase3SprintHubTab = lazyRetry(() => import('@/components/admin/tabs/Phase3SprintHubTab'));
const Phase4SprintHubTab = lazyRetry(() => import('@/components/admin/tabs/Phase4SprintHubTab'));
const ClinicEnrichmentTab = lazyRetry(() => import('@/components/admin/tabs/ClinicEnrichmentTab'));
const EmailEnrichmentBotTab = lazyRetry(() => import('@/components/admin/tabs/EmailEnrichmentBotTab'));
const SystemAuditTab = lazyRetry(() => import('@/components/admin/tabs/SystemAuditTab'));
const FeatureFlagsTab = lazyRetry(() => import('@/components/admin/tabs/FeatureFlagsTab'));
const MarketplaceControlTab = lazyRetry(() => import('@/components/admin/tabs/MarketplaceControlTab'));
const BookingSystemTab = lazyRetry(() => import('@/components/admin/tabs/BookingSystemTab'));
const TabVisibilityTab = lazyRetry(() => import('@/components/admin/tabs/TabVisibilityTab'));
const VisitorAnalyticsTab = lazyRetry(() => import('@/components/admin/tabs/VisitorAnalyticsTab'));
const StaticPagesTab = lazyRetry(() => import('@/components/admin/tabs/StaticPagesTab'));
const SeoHealthCheckTab = lazyRetry(() => import('@/components/admin/tabs/SeoHealthCheckTab'));
const MetaOptimizerTab = lazyRetry(() => import('@/components/admin/tabs/MetaOptimizerTab'));
const GeoExpansionTab = lazyRetry(() => import('@/components/admin/tabs/GeoExpansionTab'));
const StructuredDataTab = lazyRetry(() => import('@/components/admin/tabs/StructuredDataTab'));
const ToolsManagementTab = lazyRetry(() => import('@/components/admin/tabs/ToolsManagementTab'));
const AvailabilityManagementTab = lazyRetry(() => import('@/components/dentist/AvailabilityManagementTab'));
const AppointmentTypesTab = lazyRetry(() => import('@/components/dentist/AppointmentTypesTab'));
const AnalyticsTab = lazyRetry(() => import('@/components/dentist/AnalyticsTab'));
const MarketingTab = lazyRetry(() => import('@/components/dentist/MarketingTab'));
const SEOTab = lazyRetry(() => import('@/components/dentist/SEOTab'));
const MigrationControlTab = lazyRetry(() => import('@/components/admin/tabs/MigrationControlTab').then(m => ({ default: m.MigrationControlTab })));
const DataRecoveryTab = lazyRetry(() => import('@/components/admin/tabs/DataRecoveryTab'));
const AdminRevertTab = lazyRetry(() => import('@/components/admin/tabs/AdminRevertTab'));
const ListingsQueueTab = lazyRetry(() => import('@/components/admin/tabs/ListingsQueueTab'));

import NotificationCenter from '@/components/admin/NotificationCenter';
import { useNotificationSubscription } from '@/hooks/useNotifications';
import { useTabVisibility } from '@/hooks/useTabVisibility';
import { useUserTabAccess } from '@/hooks/useUserTabAccess';

// Lazy load the V2 dashboard for dentists
const DentistDashboardV2 = lazyRetry(() => import('@/components/dashboard-v2/DentistDashboardV2'));

// Define tabs for dentists (comprehensive view)
const dentistTabGroups = [
{
      label: 'Data & SEO',
      tabs: [
        { id: 'locations', label: 'Locations', icon: MapPin },
        { id: 'location-audit', label: 'Location Fix', icon: RotateCcw },
      ],
    },
  {
    label: 'Operations',
    tabs: [
      { id: 'my-appointments', label: 'Appointments', icon: Calendar, highlight: true },
      { id: 'my-availability', label: 'Availability', icon: Clock },
      { id: 'my-appointment-types', label: 'Appointment Types', icon: Stethoscope },
      { id: 'my-patients', label: 'Patients', icon: Users },
      { id: 'my-messages', label: 'Messages', icon: Inbox },
      { id: 'my-intake-forms', label: 'Intake Forms', icon: ClipboardList },
      { id: 'my-operations', label: 'Automation', icon: Zap },
    ],
  },
  {
    label: 'Profile',
    tabs: [
      { id: 'my-profile', label: 'Edit Profile', icon: Building2 },
      { id: 'my-team', label: 'Team', icon: Users },
      { id: 'my-services', label: 'Services', icon: Stethoscope },
      { id: 'my-insurance', label: 'Insurance', icon: Shield },
    ],
  },
  {
    label: 'Reputation',
    tabs: [
      { id: 'my-reputation', label: 'Reputation Suite', icon: Star, highlight: true },
    ],
  },
  {
    label: 'Communication',
    tabs: [
      { id: 'my-templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    label: 'Settings',
    tabs: [
      { id: 'my-settings', label: 'Settings', icon: Settings },
      { id: 'my-support', label: 'Support Tickets', icon: Shield },
    ],
  },
];

const adminTabGroups = [
  {
    label: 'Main',
    tabs: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'weekly', label: 'Report', icon: TrendingUp },
    ],
  },
  {
    label: 'Users',
    tabs: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'listings-queue', label: 'Listings', icon: Shield, highlight: true },
      { id: 'clinics', label: 'Clinics', icon: Building2 },
      { id: 'claims', label: 'Claims', icon: Shield },
      { id: 'treatments', label: 'Treatments', icon: Stethoscope },
      { id: 'locations', label: 'Locations', icon: MapPin },
      { id: 'location-audit', label: 'Location Fix', icon: RotateCcw },
    ],
  },
  {
    label: 'Business',
    tabs: [
      { id: 'appointments', label: 'Appointments', icon: Calendar },
      { id: 'leads', label: 'Leads', icon: UserPlus },
      { id: 'booking-system', label: 'Booking', icon: CalendarDays },
      { id: 'visitor-analytics', label: 'Analytics', icon: Activity },
    ],
  },
  {
    label: 'Reputation',
    tabs: [
      { id: 'reputation-hub', label: 'Hub', icon: Shield },
      { id: 'review-insights', label: 'Reviews', icon: MessageSquare },
      { id: 'gmb-connections', label: 'GMB', icon: Globe },
    ],
  },
  {
    label: 'Marketing',
    tabs: [
      { id: 'gmb-scraper', label: 'Scraper', icon: Bot },
      { id: 'email-enrichment', label: 'Email', icon: Mail },
      { id: 'gmb-bridge', label: 'Import', icon: Globe },
      { id: 'outreach', label: 'Outreach', icon: Mail },
      { id: 'promotions', label: 'Promos', icon: Target },
    ],
  },
  {
    label: 'Content',
    tabs: [
      { id: 'clinic-enrichment', label: 'Enrichment', icon: Sparkles },
      { id: 'content-studio', label: 'Studio', icon: Sparkles },
      { id: 'content-hub', label: 'Hub', icon: Layers },
      { id: 'content-audit', label: 'Audit', icon: Activity },
      { id: 'blog-management', label: 'Blog', icon: BookOpen },
      { id: 'pages', label: 'Pages', icon: FileText },
      { id: 'blog', label: 'Blog Posts', icon: BookOpen },
      { id: 'static-pages', label: 'Static', icon: Globe },
    ],
  },
  {
    label: 'SEO',
    tabs: [
      { id: 'seo-operations', label: 'Operations', icon: Sparkles },
      { id: 'seo-command-center', label: 'Command', icon: Sparkles },
      { id: 'structured-data', label: 'Schema', icon: Database },
      { id: 'seo-health', label: 'Health', icon: Activity },
      { id: 'meta-optimizer', label: 'Meta', icon: Search },
      { id: 'ranking-rules', label: 'Ranking', icon: TrendingUp },
      { id: 'pinned-profiles', label: 'Pinned', icon: Star },
      { id: 'top-dentists', label: 'Top', icon: Star },
    ],
  },
  {
    label: 'System',
    tabs: [
      { id: 'roles', label: 'Roles', icon: Lock },
      { id: 'feature-flags', label: 'Flags', icon: Flag },
      { id: 'automation', label: 'Automation', icon: Zap },
      { id: 'ai-controls', label: 'AI', icon: Bot },
      { id: 'ai-search-control', label: 'AI Search', icon: Search },
      { id: 'api-control', label: 'API', icon: Zap },
      { id: 'support-admin', label: 'Support', icon: Shield },
      { id: 'audit', label: 'Logs', icon: ClipboardList },
    ],
  },
  {
    label: 'Config',
    tabs: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'site-config', label: 'Site', icon: Palette },
      { id: 'plans', label: 'Plans', icon: CreditCard },
      { id: 'subscriptions', label: 'Revenue', icon: CreditCard },
      { id: 'tab-visibility', label: 'Tabs', icon: Activity },
    ],
  },
  {
    label: 'Advanced',
    tabs: [
      { id: 'system-audit', label: 'Audit', icon: Activity },
      { id: 'platform-services', label: 'Services', icon: Zap },
      { id: 'marketplace-control', label: 'Marketplace', icon: Target },
      { id: 'migration-control', label: 'Migration', icon: Database },
      { id: 'data-recovery', label: 'Recovery', icon: RotateCcw },
      { id: 'admin-revert', label: 'Revert', icon: ClipboardList },
      { id: 'smoke-test', label: 'Smoke Test', icon: Globe },
      { id: 'geo-expansion', label: 'Geo', icon: Globe },
    ],
  },
];

export default function AdminDashboard() {
  const { user, roles, signOut, isLoading, refreshRoles } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Define roles that can access admin dashboard
  const ADMIN_ROLES = ['super_admin', 'district_manager', 'seo_team', 'content_team', 'marketing_team', 'support_team'];
  const isAdmin = roles.some(role => ADMIN_ROLES.includes(role));
  const isSuperAdmin = roles.includes('super_admin') || roles.includes('district_manager');
  const isDentist = roles.includes('dentist');
  const primaryRole = roles[0] || 'patient';

  const [activeTab, setActiveTab] = useState<string>(() => {
    const tabFromUrl = searchParams.get('tab');
    return tabFromUrl || (isAdmin ? 'overview' : 'my-dashboard');
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [roleCheckAttempts, setRoleCheckAttempts] = useState(0);

  // Set noindex for admin/dashboard pages - they should not be indexed
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');

    return () => {
      meta?.setAttribute('content', 'index, follow');
    };
  }, []);

  // Auto-refresh roles if user has no roles (may happen after fresh signup)
  useEffect(() => {
    if (isAdmin) return;

    if (!isLoading && user && roles.length === 0 && roleCheckAttempts < 2) {
      const timer = setTimeout(() => {
        refreshRoles();
        setRoleCheckAttempts(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user, roles, roleCheckAttempts, refreshRoles, isAdmin]);

  // Get global tab visibility settings
  const { isTabVisible } = useTabVisibility();

  // Get user-specific tab access permissions
  const { canAccessTab, hasFullAccess } = useUserTabAccess();

  // Determine which tab groups to show and filter by visibility + user permissions
  const rawTabGroups = isAdmin ? adminTabGroups : dentistTabGroups;
  const dashboardType = isAdmin ? 'admin' : 'dentist';

  const tabGroups = useMemo(() =>
    rawTabGroups.map(group => ({
      ...group,
      tabs: group.tabs.filter(tab => {
        if (!isTabVisible(tab.id, dashboardType)) return false;
        if (dashboardType === 'admin' && !hasFullAccess) {
          return canAccessTab(tab.id);
        }
        return true;
      }),
    })).filter(group => group.tabs.length > 0),
    [rawTabGroups, dashboardType, isTabVisible, hasFullAccess, canAccessTab]
  );

  // Helper to navigate to a tab - just update state and URL without triggering re-renders
  const navigateToTab = (tabId: string) => {
    const basePath = isAdmin ? '/admin' : '/dashboard';
    setActiveTab(tabId);
    // Use window.history to avoid React re-render cycle
    window.history.replaceState(null, '', `${basePath}?tab=${tabId}`);
  };

  // Sync active tab from URL ONLY on initial mount or when searchParams actually change from outside
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const { data: notifications } = useBookingNotifications();
  const markRead = useMarkNotificationRead();
  const unreadCount = notifications?.length || 0;

  // Subscribe to real-time notifications
  useNotificationSubscription();

  // Real-time notifications
  useEffect(() => {
    const channel = supabase
      .channel('booking-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_notifications',
      }, () => {
        // Refetch handled by react-query
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Only show loading if auth is genuinely loading (not during tab switches)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Route separation:
  // - /admin is for admins only
  // - /dashboard is for dentists only
  const tabParam = searchParams.get('tab');

  // If a dentist lands on /admin, push them to the dentist dashboard route
  if (location.pathname.startsWith('/admin') && !isAdmin && isDentist) {
    const targetTab = tabParam && tabParam.startsWith('my-') ? tabParam : 'my-dashboard';
    return <Navigate to={`/dashboard?tab=${encodeURIComponent(targetTab)}`} replace />;
  }

  // If an admin lands on /dashboard, push them to /admin but preserve the tab param
  if (location.pathname.startsWith('/dashboard') && isAdmin) {
    const preservedTab = tabParam || 'overview';
    return <Navigate to={`/admin?tab=${preservedTab}`} replace />;
  }

  // Access control: admins and dentists only
  // Give a retry option for users who just signed up and roles haven't propagated yet
  // SuperAdmins never see this screen - they are fast-tracked
  if (!isAdmin && !isDentist && roleCheckAttempts >= 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-background">
        <div className="text-center p-8 bg-card rounded-2xl shadow-lg border max-w-md">
          <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Setting Up Your Account</h1>
          <p className="text-muted-foreground mb-4">
            We're finalizing your account setup. This should only take a moment.
          </p>
          <div className="mt-6 flex gap-2 justify-center">
            <Button
              variant="default"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            If this persists, try signing out and signing in again.
          </p>
        </div>
      </div>
    );
  }

  // Still loading roles - show loading spinner instead of "Setting Up Account" prematurely
  // SuperAdmins bypass this entirely
  if (!isAdmin && !isDentist && roleCheckAttempts < 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if this is a dentist accessing their dashboard - redirect to V2
  const isDentistRoute = location.pathname.startsWith('/dashboard') && isDentist && !isAdmin;

  // For dentists, use the redesigned V2 dashboard
  if (isDentistRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      }>
        <DentistDashboardV2 />
      </Suspense>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'my-dashboard': return <DentistDashboardTab />;
      case 'my-appointments': return <DentistAppointmentsTab />;
      case 'my-availability': return <AvailabilityManagementTab />;
      case 'my-appointment-types': return <AppointmentTypesTab />;
      case 'my-patients': return <PatientsTab />;
      case 'my-messages': return <MessagesTab />;
      case 'my-operations': return <OperationsTab />;
      case 'my-intake-forms': return <IntakeFormsTab />;
      case 'my-profile': return <ProfileEditorTab />;
      case 'my-team': return <TeamManagementTab />;
      case 'my-services': return <ServicesTab />;
      case 'my-insurance': return <InsuranceManagementTab />;
      case 'my-reputation': return <DentistReputationHub />;
      case 'my-analytics': return <AnalyticsTab />;
      case 'my-marketing': return <MarketingTab />;
      case 'my-seo': return <SEOTab />;
      case 'my-templates': return <TemplatesTab />;
      case 'my-settings': return <DentistSettingsTab />;
      case 'my-support': return <SupportTicketsTab />;
      case 'overview': return <OverviewTab />;
      case 'weekly': return <FounderWeeklyTab />;
      case 'gmb-bridge': return <GmbBridgeTab />;
      case 'gmb-scraper': return <GmbScraperBotTab />;
      case 'gmb-connections': return <GMBConnectionsTab />;
      case 'email-enrichment': return <EmailEnrichmentBotTab />;
      case 'outreach': return <OutreachTab />;
      case 'ranking-rules': return <RankingRulesTab />;
      case 'pinned-profiles': return <PinnedProfilesTab />;
      case 'top-dentists': return <TopDentistsTab />;
      case 'promotions': return <PromotionsTab />;
      case 'locations': return <LocationsTab />;
      case 'location-audit': return <LocationAuditTab />;
      case 'treatments': return <TreatmentsTab />;
      case 'clinics': return <ClinicsTab />;
      case 'listings-queue': return <ListingsQueueTab />;
      case 'claims': return <ClaimsTab />;
      case 'users': return <UsersTab />;
      case 'booking-system': return <BookingSystemTab />;
      case 'appointments': return <AppointmentsTab />;
      case 'visitor-analytics': return <VisitorAnalyticsTab />;
      case 'leads': return <LeadsTab />;
      case 'pages': return <PagesTab />;
      case 'blog': return <BlogTab />;
      case 'seo': return <SeoTab />;
      case 'static-pages': return <StaticPagesTab />;
      case 'seo-health': return <SeoHealthCheckTab />;
      case 'seo-command-center': return <SeoCommandCenterTab />;
      case 'seo-operations': return <SeoOperationsCenterTab />;
      case 'meta-optimizer': return <MetaOptimizerTab />;
      case 'seo-expert': return <SeoExpertTab />;
      case 'structured-data': return <StructuredDataTab />;
      case 'seo-bot': return <SeoBotTab />;
      case 'seo-copilot': return <SeoCopilotTab />;
      case 'seo-content-optimizer': return <SeoContentOptimizerTab />;
      case 'phase2-sprint-hub': return <Phase2SprintHubTab />;
      case 'phase3-sprint-hub': return <Phase3SprintHubTab />;
      case 'phase4-sprint-hub': return <Phase4SprintHubTab />;
      case 'content-studio': return <ContentGenerationStudioTab />;
      case 'tools-management': return <ToolsManagementTab />;
      case 'faq-studio': return <FAQGenerationStudioTab />;
      case 'content-audit': return <ContentAuditBotTab />;
      case 'content-hub': return <ContentHubTab />;
      case 'blog-management': return <BlogManagementTab />;
      case 'content-automation': return <ContentAutomationTab />;
      case 'clinic-enrichment': return <ClinicEnrichmentTab />;
      case 'smoke-test': return <SmokeTestTab />;
      case 'automation': return <AutomationTab />;
      case 'ai-controls': return <AIControlsTab />;
      case 'ai-search-control': return <AISearchControlTab />;
      case 'api-control': return <ApiControlTab />;
      case 'platform-services': return <PlatformServicesTab />;
      case 'support-admin': return <SupportTicketsAdminTab />;
      case 'reputation-hub': return <AdminReputationHub />;
      case 'review-insights': return <ReviewInsightsTab />;
      case 'crm-numbers': return <CrmNumbersTab />;
      case 'messaging-control': return <MessagingControlTab />;
      case 'plans': return <PlansTab />;
      case 'roles': return <RolesTab />;
      case 'subscriptions': return <SubscriptionsTab />;
      case 'audit': return <AuditLogsTab />;
      case 'system-audit': return <SystemAuditTab />;
      case 'feature-flags': return <FeatureFlagsTab />;
      case 'marketplace-control': return <MarketplaceControlTab />;
      case 'site-config': return <SiteConfigTab />;
      case 'contact-details': return <ContactDetailsTab />;
      case 'tab-visibility': return <TabVisibilityTab />;
      case 'migration-control': return <MigrationControlTab />;
      case 'data-recovery': return <DataRecoveryTab />;
      case 'admin-revert': return <AdminRevertTab />;
      case 'settings': return <SettingsTab />;
      case 'geo-expansion': return <GeoExpansionTab />;
      // Default to Overview for admin route, DentistDashboard only for dentist route
      default:
        // If on admin route, always show OverviewTab as fallback
        if (location.pathname.startsWith('/admin')) {
          return <OverviewTab />;
        }
        return <DentistDashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar - Professional Dark Design */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 overflow-hidden',
          'bg-slate-900 dark:bg-slate-900 border-r border-slate-800',
          sidebarOpen ? 'w-60' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-slate-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Command className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white text-sm">Admin</span>
            </div>
          )}
          {!sidebarOpen && (
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto">
              <Command className="h-4 w-4 text-white" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-5 px-2">
            {tabGroups.map((group, idx) => (
              <div key={group.label}>
                {sidebarOpen && (
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.tabs.slice(0, sidebarOpen ? group.tabs.length : 4).map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => navigateToTab(tab.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative',
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {sidebarOpen && (
                          <>
                            <span className="truncate flex-1 text-left">{tab.label}</span>
                            {tab.id === 'appointments' && unreadCount > 0 && (
                              <Badge className="ml-auto bg-white/20 text-white text-[10px] h-5 min-w-5 flex items-center justify-center border-0">
                                {unreadCount}
                              </Badge>
                            )}
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

        {/* User info & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className={cn('flex items-center gap-2.5', !sidebarOpen && 'justify-center')}>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {user.email?.[0]?.toUpperCase() || 'A'}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.email}</p>
                <p className="text-[10px] text-slate-500 capitalize">{primaryRole?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size={sidebarOpen ? 'sm' : 'icon'}
            onClick={signOut}
            className={cn('mt-2 w-full text-slate-400 hover:text-red-400 hover:bg-slate-800', !sidebarOpen && 'justify-center')}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 text-xs">Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300 min-h-screen',
          sidebarOpen ? 'ml-60' : 'ml-16'
        )}
      >
        {/* Top bar - Clean Professional */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-slate-400" />
              <span className="text-slate-300">/</span>
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                {tabGroups.flatMap(g => g.tabs).find(t => t.id === activeTab)?.label || 'Dashboard'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Search */}
            <div className="hidden md:flex items-center">
              <div className="relative">
                <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search (⌘K)"
                  className="w-48 h-8 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Live</span>
            </div>
            {/* Notification */}
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 lg:p-6 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-3.5rem)]">
          <Suspense fallback={
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                <p className="mt-3 text-sm text-slate-500">Loading...</p>
              </div>
            </div>
          }>
            {renderTab()}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
