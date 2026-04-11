import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { GeocodingTool } from '../GeocodingTool';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Building2,
  Calendar,
  MapPin,
  Star,
  Shield,
  Link2,
  Database,
  Zap,
  FileText,
  MessageSquare,
  CreditCard,
  Globe,
  Search,
  Settings,
  Activity,
  Layers
} from 'lucide-react';

interface SystemModule {
  id: string;
  name: string;
  status: 'active' | 'partial' | 'missing';
  description: string;
  tables: string[];
  integrationPoints: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

interface BookingAudit {
  type: 'lead_form' | 'calendar_booking' | 'call_only' | 'external_link';
  hasSlotSelection: boolean;
  hasRealTimeAvailability: boolean;
  hasDoubleBookingPrevention: boolean;
  hasPatientOTP: boolean;
}

export default function SystemAuditTab() {
  // Fetch counts from key tables
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['system-audit-stats'],
    queryFn: async () => {
      const [
        { count: clinicsCount },
        { count: dentistsCount },
        { count: appointmentsCount },
        { count: leadsCount },
        { count: reviewsCount },
        { count: usersCount },
        { count: citiesCount },
        { count: statesCount },
        { count: treatmentsCount },
        { count: insurancesCount },
      ] = await Promise.all([
        supabase.from('clinics').select('*', { count: 'exact', head: true }),
        supabase.from('dentists').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('internal_reviews').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }),
        supabase.from('cities').select('*', { count: 'exact', head: true }),
        supabase.from('states').select('*', { count: 'exact', head: true }),
        supabase.from('treatments').select('*', { count: 'exact', head: true }),
        supabase.from('insurances').select('*', { count: 'exact', head: true }),
      ]);

      return {
        clinics: clinicsCount || 0,
        dentists: dentistsCount || 0,
        appointments: appointmentsCount || 0,
        leads: leadsCount || 0,
        reviews: reviewsCount || 0,
        users: usersCount || 0,
        cities: citiesCount || 0,
        states: statesCount || 0,
        treatments: treatmentsCount || 0,
        insurances: insurancesCount || 0,
      };
    },
  });

  // Define existing modules based on audit
  const existingModules: SystemModule[] = [
    {
      id: 'auth',
      name: 'Authentication & Roles',
      status: 'active',
      description: 'Supabase Auth with role-based access (super_admin, district_manager, dentist)',
      tables: ['user_roles', 'user_onboarding', 'user_permission_overrides'],
      integrationPoints: ['Google OAuth', 'Email/Password'],
      riskLevel: 'low',
    },
    {
      id: 'clinics',
      name: 'Clinic Management',
      status: 'active',
      description: 'Clinic profiles with GMB sync, claim flow, hours, images, treatments',
      tables: ['clinics', 'clinic_hours', 'clinic_images', 'clinic_treatments', 'clinic_insurances', 'clinic_oauth_tokens'],
      integrationPoints: ['GMB Import', 'GMB Booking Link', 'Manual Entry'],
      riskLevel: 'low',
    },
    {
      id: 'dentists',
      name: 'Dentist Profiles',
      status: 'active',
      description: 'Individual dentist profiles linked to clinics',
      tables: ['dentists'],
      integrationPoints: ['Clinic Team Management'],
      riskLevel: 'low',
    },
    {
      id: 'appointments',
      name: 'Appointment System',
      status: 'partial',
      description: 'Lead-based booking with calendar preference. NO real-time slot selection yet.',
      tables: ['appointments', 'booking_notifications', 'leads'],
      integrationPoints: ['Booking Modal', 'Email Notifications'],
      riskLevel: 'medium',
    },
    {
      id: 'reviews',
      name: 'Review System',
      status: 'active',
      description: 'Internal reviews + Google review sync with AI sentiment analysis',
      tables: ['internal_reviews', 'google_reviews', 'review_requests', 'review_funnel_events'],
      integrationPoints: ['Review Funnel', 'Google Reviews Sync', 'AI Replies'],
      riskLevel: 'low',
    },
    {
      id: 'locations',
      name: 'Location Hierarchy',
      status: 'active',
      description: 'Countries → States → Cities → Areas structure (US focused)',
      tables: ['countries', 'states', 'cities', 'areas'],
      integrationPoints: ['GMB Scraper', 'Manual Entry'],
      riskLevel: 'low',
    },
    {
      id: 'treatments',
      name: 'Treatments & Services',
      status: 'active',
      description: 'Treatment catalog with categories and SEO slugs',
      tables: ['treatments', 'clinic_treatments'],
      integrationPoints: ['Search Filters', 'Booking Form'],
      riskLevel: 'low',
    },
    {
      id: 'insurance',
      name: 'Insurance Providers',
      status: 'partial',
      description: 'Insurance list exists but filtering/matching is basic',
      tables: ['insurances', 'clinic_insurances'],
      integrationPoints: ['Clinic Profile', 'Booking Form'],
      riskLevel: 'low',
    },
    {
      id: 'subscriptions',
      name: 'Subscription Plans',
      status: 'active',
      description: 'Tiered plans with Stripe integration and feature gating',
      tables: ['subscription_plans', 'clinic_subscriptions', 'plan_features', 'lead_quotas'],
      integrationPoints: ['Stripe Checkout', 'Feature Flags'],
      riskLevel: 'low',
    },
    {
      id: 'gmb',
      name: 'Google Business Profile',
      status: 'active',
      description: 'GMB sync, booking link injection, OAuth tokens, scraper',
      tables: ['clinic_oauth_tokens', 'gmb_imports', 'gmb_scraper_sessions', 'gmb_link_requests'],
      integrationPoints: ['Google OAuth', 'Place Actions API', 'Places API'],
      riskLevel: 'low',
    },
    {
      id: 'ai',
      name: 'AI Features',
      status: 'active',
      description: 'AI assistant, review sentiment, reply generation',
      tables: ['ai_conversations', 'ai_events', 'ai_outputs', 'ai_prompt_templates'],
      integrationPoints: ['Gemini API', 'OpenAI (optional)'],
      riskLevel: 'low',
    },
    {
      id: 'audit',
      name: 'Audit Logging',
      status: 'active',
      description: 'Comprehensive audit trail for all admin and system actions',
      tables: ['audit_logs', 'hipaa_audit_log'],
      integrationPoints: ['All Admin Actions'],
      riskLevel: 'low',
    },
    {
      id: 'messaging',
      name: 'Messaging System',
      status: 'active',
      description: 'SMS, WhatsApp, and email messaging for clinics',
      tables: ['clinic_messages', 'crm_numbers', 'email_templates'],
      integrationPoints: ['Twilio (placeholder)', 'WhatsApp Business'],
      riskLevel: 'medium',
    },
    {
      id: 'seo',
      name: 'SEO Management',
      status: 'active',
      description: 'Dynamic page content, sitemap, meta management',
      tables: ['seo_pages', 'page_content', 'seo_metadata_history', 'seo_bot_settings'],
      integrationPoints: ['Sitemap Edge Function', 'Meta Tags'],
      riskLevel: 'low',
    },
  ];

  // Booking behavior audit
  const bookingAudit: BookingAudit = {
    type: 'lead_form',
    hasSlotSelection: false,
    hasRealTimeAvailability: false,
    hasDoubleBookingPrevention: false,
    hasPatientOTP: false,
  };

  // User roles detected
  const userRoles = [
    { role: 'super_admin', description: 'Full platform access, all admin controls', count: '~2' },
    { role: 'district_manager', description: 'Regional management (limited use)', count: '~1' },
    { role: 'dentist', description: 'Claimed clinic owners, dashboard access', count: '~10' },
    { role: 'patient', description: 'Implicit role (no user_roles entry needed)', count: 'N/A' },
  ];

  // Integration status
  const integrations = [
    { name: 'Google OAuth', status: 'active', notes: 'Working for GMB sync and login' },
    { name: 'Google Business Profile API', status: 'active', notes: 'Booking link sync implemented' },
    { name: 'Google Places API', status: 'active', notes: 'Clinic import/scraper' },
    { name: 'Stripe', status: 'active', notes: 'Checkout sessions and webhooks' },
    { name: 'Twilio/SMS', status: 'placeholder', notes: 'Edge function exists, credentials needed' },
    { name: 'WhatsApp Business', status: 'placeholder', notes: 'Edge function exists, credentials needed' },
    { name: 'Gemini AI', status: 'active', notes: 'Review analysis, AI assistant' },
    { name: 'SMTP (Hostinger)', status: 'active', notes: 'Email sending for bookings' },
  ];

  // Risk assessment for new features
  const riskChecklist = [
    { item: 'Adding slot-based booking', risk: 'medium', mitigation: 'Add new tables, use feature flags' },
    { item: 'Booking default ON enforcement', risk: 'low', mitigation: 'Add dentist_settings table, default TRUE' },
    { item: 'Insurance-first search', risk: 'low', mitigation: 'Extend existing filters, no schema change' },
    { item: 'AI matching engine', risk: 'low', mitigation: 'Scoring logic in edge function, configurable weights' },
    { item: 'Availability rules', risk: 'low', mitigation: 'New tables, does not touch existing' },
  ];

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          System Audit Report
        </h1>
        <p className="text-muted-foreground mt-1">
          Phase 0 Discovery — Read-only snapshot of existing modules before building new features
        </p>
        <Badge className="mt-2" variant="outline">
          Generated: {new Date().toLocaleString()}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.clinics.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Clinics</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal/10 to-teal/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-teal" />
              <div>
                <p className="text-2xl font-bold">{stats?.dentists.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Dentists</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-coral/10 to-coral/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-coral" />
              <div>
                <p className="text-2xl font-bold">{stats?.appointments}</p>
                <p className="text-xs text-muted-foreground">Appointments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber/10 to-amber/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Star className="h-8 w-8 text-amber" />
              <div>
                <p className="text-2xl font-bold">{stats?.reviews}</p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate/10 to-slate/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-slate-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.cities}</p>
                <p className="text-xs text-muted-foreground">Cities ({stats?.states} States)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Existing Modules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Existing Modules
            </CardTitle>
            <CardDescription>
              Current system components and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {existingModules.map(module => (
                  <div key={module.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{module.name}</span>
                          <Badge
                            variant={module.status === 'active' ? 'default' : 'secondary'}
                            className={
                              module.status === 'active'
                                ? 'bg-teal/20 text-teal'
                                : module.status === 'partial'
                                ? 'bg-amber/20 text-amber'
                                : 'bg-coral/20 text-coral'
                            }
                          >
                            {module.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{module.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {module.riskLevel} risk
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {module.tables.slice(0, 3).map(table => (
                        <Badge key={table} variant="outline" className="text-[10px]">
                          {table}
                        </Badge>
                      ))}
                      {module.tables.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{module.tables.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* User Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              User Roles
            </CardTitle>
            <CardDescription>
              Current role-based access control structure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {userRoles.map(role => (
              <div key={role.role} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{role.role}</code>
                  <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                </div>
                <Badge variant="outline">{role.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Current Booking Behavior */}
        <Card className="border-amber/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber" />
              Current Booking Behavior
            </CardTitle>
            <CardDescription>
              How appointments work TODAY (before booking engine features)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber/10 border border-amber/20">
                <p className="font-medium text-sm">Type: Lead Form + Calendar Preference</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Users submit preferred date/time, clinic confirms manually. NOT real-time slots.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Real-time slot selection</span>
                  <XCircle className="h-4 w-4 text-coral" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Dentist availability rules</span>
                  <XCircle className="h-4 w-4 text-coral" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Double-booking prevention (locks)</span>
                  <XCircle className="h-4 w-4 text-coral" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Appointment types with duration</span>
                  <XCircle className="h-4 w-4 text-coral" />
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm">
                  <span>Email notifications</span>
                  <CheckCircle className="h-4 w-4 text-teal" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Appointment status workflow</span>
                  <CheckCircle className="h-4 w-4 text-teal" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Self-service manage/cancel link</span>
                  <CheckCircle className="h-4 w-4 text-teal" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Integration Status
            </CardTitle>
            <CardDescription>
              External services and API connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {integrations.map(int => (
                <div key={int.name} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                  <div>
                    <span className="text-sm font-medium">{int.name}</span>
                    <p className="text-xs text-muted-foreground">{int.notes}</p>
                  </div>
                  <Badge
                    variant={int.status === 'active' ? 'default' : 'secondary'}
                    className={int.status === 'active' ? 'bg-teal/20 text-teal' : ''}
                  >
                    {int.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Checklist for New Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber" />
            Risk Checklist for Booking Features
          </CardTitle>
          <CardDescription>
            Assessment of new feature implementation risks and mitigations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Feature</th>
                  <th className="text-left p-2">Risk Level</th>
                  <th className="text-left p-2">Mitigation Strategy</th>
                </tr>
              </thead>
              <tbody>
                {riskChecklist.map(item => (
                  <tr key={item.item} className="border-b last:border-0">
                    <td className="p-2 font-medium">{item.item}</td>
                    <td className="p-2">
                      <Badge
                        variant="outline"
                        className={
                          item.risk === 'low'
                            ? 'border-teal text-teal'
                            : item.risk === 'medium'
                            ? 'border-amber text-amber'
                            : 'border-coral text-coral'
                        }
                      >
                        {item.risk}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{item.mitigation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Database Tables Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Schema Summary
          </CardTitle>
          <CardDescription>
            80+ tables currently in production. Key tables for booking engine features highlighted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm mb-2">Core Entities</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• clinics</p>
                <p>• dentists</p>
                <p>• patients</p>
                <p>• appointments</p>
                <p>• leads</p>
              </div>
            </div>
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm mb-2">Location</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• countries</p>
                <p>• states</p>
                <p>• cities</p>
                <p>• areas</p>
              </div>
            </div>
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm mb-2">Features</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• treatments</p>
                <p>• insurances</p>
                <p>• clinic_hours</p>
                <p>• internal_reviews</p>
                <p>• google_reviews</p>
              </div>
            </div>
            <div className="p-3 rounded-lg border border-primary/30">
              <h4 className="font-medium text-sm mb-2 text-primary">To Add (Booking Engine)</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• feature_flags ✨</p>
                <p>• appointment_types ✨</p>
                <p>• availability_rules ✨</p>
                <p>• slot_locks ✨</p>
                <p>• dentist_settings ✨</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Geocoding Tool for Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-600" />
            Map Coordinates Setup
          </CardTitle>
          <CardDescription>
            Add coordinates to clinics so they appear on the interactive map
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GeocodingTool />
        </CardContent>
      </Card>

      {/* Ready to Proceed */}
      <Card className="border-teal bg-teal/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <CheckCircle className="h-12 w-12 text-teal shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-foreground">Audit Complete</h3>
              <p className="text-muted-foreground">
                The system has been audited. Proceed to Phase 1: Feature Flags to safely add new booking engine functionality.
                All new features will be additive and behind toggles.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
