/**
 * Dentist Dashboard Overview V3
 * Completely redesigned with modern, clean aesthetics
 * Bold typography, minimal design, high contrast
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { 
  Calendar, 
  Users, 
  Star, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Globe,
  QrCode,
  Send,
  Plus,
  Eye,
  Shield,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MessageSquare,
  Settings,
  Bell,
  ChevronRight,
  Mail,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ModernCard,
  StatsCard,
  ProgressRingCard,
  ActionButton,
  SectionTitle,
  StatusBadgeNew,
  EmptyStateNew,
  ActivityItem,
  StatsCardSkeleton,
} from './NewDesignSystem';
import { NoPracticeLinked } from '@/components/dentist/NoPracticeLinked';

interface DashboardOverviewV3Props {
  onNavigate: (tab: string) => void;
}

export default function DashboardOverviewV3({ onNavigate }: DashboardOverviewV3Props) {
  const { user, profile } = useAuth();

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dashboard-v3-clinic', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*, clinic_hours(*), clinic_images(*)')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch today's appointments
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['dashboard-v3-today-appts', clinic?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('appointments')
        .select('*, treatment:treatments(name), patient:patients(*)')
        .eq('clinic_id', clinic?.id)
        .gte('preferred_date', today)
        .lte('preferred_date', today)
        .order('preferred_time');
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch patient stats
  const { data: patientStats } = useQuery({
    queryKey: ['dashboard-v3-patient-stats', clinic?.id],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id);
      
      const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count: newThisMonth } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id)
        .gte('created_at', thisMonth);
      
      return { total: total || 0, newThisMonth: newThisMonth || 0 };
    },
    enabled: !!clinic?.id,
  });

  // Fetch recent feedback (from review_funnel_events)
  const { data: recentFeedback = [] } = useQuery({
    queryKey: ['dashboard-v3-feedback', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Loading state
  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // No clinic state
  if (!clinic) {
    return <NoPracticeLinked />;
  }

  // Calculate metrics
  const pendingAppts = todayAppointments.filter(a => a.status === 'pending').length;
  const confirmedAppts = todayAppointments.filter(a => a.status === 'confirmed').length;
  const completedAppts = todayAppointments.filter(a => a.status === 'completed').length;
  
  const profileCompleteness = Math.min(
    Math.round(
      ([
        clinic.name,
        clinic.description,
        clinic.address,
        clinic.phone,
        clinic.email,
        clinic.cover_image_url,
        clinic.google_place_id,
        clinic.clinic_hours?.length > 0,
      ].filter(Boolean).length / 8) * 100
    ),
    100
  );

  const avgRating = clinic.rating ? Number(clinic.rating) : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header - Bold & Clean */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Here's what's happening at <span className="font-semibold text-gray-900">{clinic.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg gap-2"
            onClick={() => onNavigate('my-profile')}
          >
            <Eye className="h-4 w-4" />
            View Profile
          </Button>
          <Button
            size="sm"
            className="rounded-lg gap-2 bg-gray-900 hover:bg-gray-800"
            onClick={() => onNavigate('my-reputation')}
          >
            <QrCode className="h-4 w-4" />
            Get QR Code
          </Button>
        </div>
      </div>

      {/* Main Stats Grid - Clean & Bold */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Patients"
          value={patientStats?.total || 0}
          change={12}
          changeLabel="vs last month"
          icon={Users}
          iconColor="text-indigo-600"
          onClick={() => onNavigate('my-patients')}
        />
        <StatsCard
          label="Today's Appointments"
          value={todayAppointments.length}
          icon={Calendar}
          iconColor="text-violet-600"
          onClick={() => onNavigate('my-appointments')}
        />
        <StatsCard
          label="Avg Rating"
          value={avgRating > 0 ? avgRating.toFixed(1) : '—'}
          icon={Star}
          iconColor="text-amber-500"
          onClick={() => onNavigate('my-reputation')}
        />
        <StatsCard
          label="Total Reviews"
          value={clinic.review_count || 0}
          icon={MessageSquare}
          iconColor="text-blue-600"
          onClick={() => onNavigate('my-reputation')}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule */}
          <ModernCard padding="none">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Today's Schedule</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                </div>
                <Badge className="bg-gray-900 text-white">{todayAppointments.length} appointments</Badge>
              </div>
            </div>
            
            <div className="p-2">
              {todayAppointments.length === 0 ? (
                <EmptyStateNew
                  icon={Calendar}
                  title="No appointments today"
                  description="Your schedule is clear. Set up availability to get bookings."
                  action={
                    <Button variant="outline" size="sm" onClick={() => onNavigate('my-availability')}>
                      Set Availability
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-1">
                  {todayAppointments.slice(0, 6).map((appt) => (
                    <div
                      key={appt.id}
                      onClick={() => onNavigate('my-appointments')}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                    >
                      <div className="w-12 text-center flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{appt.preferred_time || 'TBD'}</p>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{appt.patient_name}</p>
                        <p className="text-xs text-gray-500 truncate">{appt.treatment?.name || 'General Visit'}</p>
                      </div>
                      <StatusBadgeNew
                        status={
                          appt.status === 'confirmed' ? 'success' :
                          appt.status === 'pending' ? 'warning' :
                          appt.status === 'completed' ? 'info' : 'neutral'
                        }
                        label={appt.status || 'pending'}
                      />
                      <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {todayAppointments.length > 0 && (
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => onNavigate('my-appointments')}
                  className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1"
                >
                  View all appointments
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </ModernCard>

          {/* Quick Actions - Grid */}
          <ModernCard>
            <SectionTitle
              title="Quick Actions"
              subtitle="Common tasks"
            />
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ActionButton
                icon={Send}
                label="Review Request"
                description="Send to patients"
                onClick={() => onNavigate('my-reputation')}
                color="bg-indigo-600"
              />
              <ActionButton
                icon={Plus}
                label="Add Patient"
                description="New registration"
                onClick={() => onNavigate('my-patients')}
                color="bg-violet-600"
              />
              <ActionButton
                icon={Calendar}
                label="Appointments"
                description="View schedule"
                onClick={() => onNavigate('my-appointments')}
                color="bg-amber-600"
              />
              <ActionButton
                icon={Eye}
                label="View Profile"
                description="Public page"
                onClick={() => onNavigate('my-profile')}
                color="bg-blue-600"
              />
              <ActionButton
                icon={Star}
                label="Reputation"
                description="Manage reviews"
                onClick={() => onNavigate('my-reputation')}
                color="bg-emerald-600"
              />
              <ActionButton
                icon={Users}
                label="Patients"
                description="Patient records"
                onClick={() => onNavigate('my-patients')}
                color="bg-rose-600"
              />
              <ActionButton
                icon={Shield}
                label="Insurance"
                description="Accepted plans"
                onClick={() => onNavigate('my-insurance')}
                color="bg-cyan-600"
              />
              <ActionButton
                icon={MessageSquare}
                label="Messages"
                description="Patient chats"
                onClick={() => onNavigate('my-messages')}
                color="bg-orange-600"
              />
            </div>
          </ModernCard>
        </div>

        {/* Right Column - Sidebar Info */}
        <div className="space-y-6">
          {/* Profile Health Ring */}
          <ModernCard>
            <SectionTitle
              title="Profile Health"
              subtitle="Complete your profile"
            />
            
            <div className="flex justify-center py-2">
              <ProgressRingCard
                label="Profile Score"
                value={profileCompleteness}
                max={100}
                color="text-indigo-600"
                subtitle={`${100 - profileCompleteness}% to complete`}
              />
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Verified</span>
                <StatusBadgeNew
                  status={clinic.verification_status === 'verified' ? 'success' : 'warning'}
                  label={clinic.verification_status === 'verified' ? 'Verified' : 'Pending'}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">GMB Connected</span>
                <StatusBadgeNew
                  status={clinic.google_place_id ? 'success' : 'neutral'}
                  label={clinic.google_place_id ? 'Connected' : 'Not linked'}
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full mt-4 rounded-lg"
              onClick={() => onNavigate('my-profile')}
            >
              Complete Profile
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </ModernCard>

          {/* Pending Actions */}
          <ModernCard>
            <SectionTitle
              title="Pending Actions"
              subtitle="Action required"
            />

            <div className="space-y-2">
              {pendingAppts > 0 && (
                <ActivityItem
                  icon={Clock}
                  iconBg="bg-amber-100"
                  iconColor="text-amber-600"
                  title={`${pendingAppts} pending appointments`}
                  description="Review and confirm"
                  onClick={() => onNavigate('my-appointments')}
                />
              )}
              {profileCompleteness < 80 && (
                <ActivityItem
                  icon={Shield}
                  iconBg="bg-indigo-100"
                  iconColor="text-indigo-600"
                  title="Profile incomplete"
                  description="Complete for better visibility"
                  onClick={() => onNavigate('my-profile')}
                />
              )}
              {!clinic.google_place_id && (
                <ActivityItem
                  icon={Globe}
                  iconBg="bg-blue-100"
                  iconColor="text-blue-600"
                  title="Connect Google Business"
                  description="Boost your visibility"
                  onClick={() => onNavigate('my-reputation')}
                />
              )}
              {pendingAppts === 0 && profileCompleteness >= 80 && clinic.google_place_id && (
                <div className="py-4 text-center">
                  <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">All caught up!</p>
                </div>
              )}
            </div>
          </ModernCard>

          {/* Recent Feedback */}
          {recentFeedback.length > 0 && (
            <ModernCard>
              <SectionTitle
                title="Recent Feedback"
                subtitle="Patient responses"
              />
              
              <div className="space-y-3">
                {recentFeedback.slice(0, 3).map((feedback: any) => (
                  <div key={feedback.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      {feedback.event_type === 'thumbs_up' ? (
                        <span className="text-emerald-500 text-sm">👍 Positive</span>
                      ) : feedback.event_type === 'thumbs_down' ? (
                        <span className="text-red-500 text-sm">👎 Needs attention</span>
                      ) : null}
                      <span className="text-xs text-gray-500">{format(new Date(feedback.created_at), 'MMM d')}</span>
                    </div>
                    {feedback.feedback_text && (
                      <p className="text-sm text-gray-700 line-clamp-2">{feedback.feedback_text}</p>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full mt-3 text-indigo-600"
                onClick={() => onNavigate('my-reputation')}
              >
                View all feedback
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </ModernCard>
          )}
        </div>
      </div>
    </div>
  );
}
