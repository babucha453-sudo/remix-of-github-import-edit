import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Lightbulb,
  QrCode,
  Send,
  Plus,
  Eye,
  Shield,
  Globe,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface DashboardWidgetsProps {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  googlePlaceId?: string;
  verificationStatus?: string;
  rating?: number;
  reviewCount?: number;
  onNavigate: (tab: string) => void;
}

export default function DashboardWidgets({
  clinicId,
  clinicName,
  clinicSlug,
  googlePlaceId,
  verificationStatus,
  rating = 0,
  reviewCount = 0,
  onNavigate,
}: DashboardWidgetsProps) {
  // Fetch review funnel events
  const { data: funnelEvents = [] } = useQuery({
    queryKey: ['dashboard-funnel', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Fetch today's appointments
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['dashboard-appointments-today', clinicId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('created_at', today);
      return data || [];
    },
  });

  // Fetch profile completeness
  const { data: clinic } = useQuery({
    queryKey: ['dashboard-clinic-profile', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('*, clinic_hours(*), clinic_images(*)')
        .eq('id', clinicId)
        .single();
      return data;
    },
  });

  // Calculate stats
  const thumbsUp = funnelEvents.filter(e => e.event_type === 'thumbs_up').length;
  const thumbsDown = funnelEvents.filter(e => e.event_type === 'thumbs_down').length;
  const totalEvents = funnelEvents.length;
  const conversionRate = totalEvents > 0 ? Math.round((thumbsUp / totalEvents) * 100) : 0;

  const pendingAppts = todayAppointments.filter(a => a.status === 'pending').length;
  const confirmedAppts = todayAppointments.filter(a => a.status === 'confirmed').length;
  const completedAppts = todayAppointments.filter(a => a.status === 'completed').length;

  // Calculate profile completeness
  const profileFields = clinic ? [
    clinic.name,
    clinic.description,
    clinic.address,
    clinic.phone,
    clinic.email,
    clinic.website,
    clinic.cover_image_url,
    clinic.google_place_id,
    (clinic.clinic_hours?.length || 0) > 0,
    (clinic.clinic_images?.length || 0) > 0,
  ] : [];
  const completedFields = profileFields.filter(Boolean).length;
  const profileCompleteness = Math.round((completedFields / 10) * 100);

  // Determine reputation health
  const reputationHealth = rating >= 4.5 ? 'excellent' : rating >= 4 ? 'good' : rating >= 3 ? 'fair' : 'needs_attention';
  const healthConfig = {
    excellent: { label: 'Excellent', color: 'emerald' },
    good: { label: 'Good', color: 'teal' },
    fair: { label: 'Fair', color: 'gold' },
    needs_attention: { label: 'Needs Attention', color: 'coral' },
  };
  const currentHealth = healthConfig[reputationHealth];

  // AI Suggestions
  const aiSuggestions = [
    thumbsDown > thumbsUp ? {
      icon: AlertCircle,
      type: 'warning' as const,
      title: 'High negative feedback rate',
      description: 'Review private feedback and address common concerns.',
    } : null,
    !googlePlaceId ? {
      icon: Globe,
      type: 'action' as const,
      title: 'Connect Google Business',
      description: 'Link your GMB to redirect happy patients to Google Reviews.',
    } : null,
    profileCompleteness < 80 ? {
      icon: Shield,
      type: 'action' as const,
      title: 'Complete your profile',
      description: `Your profile is ${profileCompleteness}% complete. Add missing info to rank higher.`,
    } : null,
    verificationStatus !== 'verified' ? {
      icon: CheckCircle,
      type: 'action' as const,
      title: 'Get verified',
      description: 'Verified clinics receive 3x more patient bookings.',
    } : null,
    {
      icon: Lightbulb,
      type: 'tip' as const,
      title: 'Send review requests',
      description: 'Ask 5 recent patients for reviews to boost your visibility.',
    },
  ].filter(Boolean).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Primary Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Reputation Snapshot */}
        <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all">
          <div className="h-1 bg-gradient-to-r from-teal to-primary rounded-t-lg" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
              <div className="p-1.5 rounded-lg bg-teal/20">
                <Star className="h-4 w-4 text-teal" />
              </div>
              Reputation Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="flex items-center gap-1">
                  <span className="text-3xl font-bold text-white">{rating.toFixed(1)}</span>
                  <Star className="h-6 w-6 text-gold fill-gold" />
                </div>
                <p className="text-xs text-white/60">{reviewCount} reviews</p>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-teal">
                    <ThumbsUp className="h-3 w-3" /> {thumbsUp}
                  </span>
                  <span className="flex items-center gap-1 text-coral">
                    <ThumbsDown className="h-3 w-3" /> {thumbsDown}
                  </span>
                </div>
                <Progress value={conversionRate} className="h-2 bg-white/10" />
                <p className="text-xs text-center text-white/60">
                  {conversionRate}% positive rate
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge 
                className={`text-xs border ${
                  reputationHealth === 'excellent' ? 'bg-teal/20 text-teal border-teal/30' :
                  reputationHealth === 'good' ? 'bg-teal/15 text-teal border-teal/25' :
                  reputationHealth === 'fair' ? 'bg-gold/20 text-gold border-gold/30' :
                  'bg-coral/20 text-coral border-coral/30'
                }`}
              >
                {reputationHealth === 'needs_attention' && <TrendingDown className="h-3 w-3 mr-1" />}
                {reputationHealth === 'excellent' && <TrendingUp className="h-3 w-3 mr-1" />}
                {currentHealth.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Review Funnel Performance */}
        <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
              <div className="p-1.5 rounded-lg bg-teal/20">
                <TrendingUp className="h-4 w-4 text-teal" />
              </div>
              Review Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-700/50 border border-slate-600/50">
                  <p className="text-xl font-bold text-white">{totalEvents}</p>
                  <p className="text-[10px] text-white/60">Total</p>
                </div>
                <div className="p-2 rounded-lg bg-teal/10 border border-teal/30">
                  <p className="text-xl font-bold text-teal">{thumbsUp}</p>
                  <p className="text-[10px] text-white/60">Positive</p>
                </div>
                <div className="p-2 rounded-lg bg-coral/10 border border-coral/30">
                  <p className="text-xl font-bold text-coral">{thumbsDown}</p>
                  <p className="text-[10px] text-white/60">Negative</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs bg-transparent border-teal/30 text-teal hover:bg-teal/10 hover:border-teal/50"
                onClick={() => onNavigate('my-reviews')}
              >
                View Analytics
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Today */}
        <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
              <div className="p-1.5 rounded-lg bg-primary/20">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              Today's Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-gold/10 border border-gold/30">
                <Clock className="h-4 w-4 text-gold mx-auto mb-1" />
                <p className="text-lg font-bold text-gold">{pendingAppts}</p>
                <p className="text-[10px] text-white/60">Pending</p>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                <CheckCircle className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-primary">{confirmedAppts}</p>
                <p className="text-[10px] text-white/60">Confirmed</p>
              </div>
              <div className="p-2.5 rounded-xl bg-teal/10 border border-teal/30">
                <Star className="h-4 w-4 text-teal mx-auto mb-1" />
                <p className="text-lg font-bold text-teal">{completedAppts}</p>
                <p className="text-[10px] text-white/60">Completed</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-3 text-xs bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
              onClick={() => onNavigate('my-appointments')}
            >
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Profile Health */}
        <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
              <div className="p-1.5 rounded-lg bg-purple/20">
                <Shield className="h-4 w-4 text-purple" />
              </div>
              Profile Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-white">{profileCompleteness}%</span>
              <Badge 
                className={profileCompleteness >= 80 
                  ? 'bg-teal/20 text-teal border border-teal/30' 
                  : 'bg-gold/20 text-gold border border-gold/30'
                }
              >
                {profileCompleteness >= 80 ? 'Good' : 'Needs Work'}
              </Badge>
            </div>
            <Progress value={profileCompleteness} className="h-2 bg-white/10" />
            <div className="flex flex-wrap gap-1">
              {verificationStatus === 'verified' ? (
                <Badge className="bg-teal/20 text-teal border border-teal/30 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" /> Verified
                </Badge>
              ) : (
                <Badge className="bg-slate-700/50 text-white/60 border border-slate-600/50 text-xs">Unverified</Badge>
              )}
              {googlePlaceId ? (
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">
                  <Globe className="h-3 w-3 mr-1" /> GMB Connected
                </Badge>
              ) : (
                <Badge className="bg-slate-700/50 text-white/60 border border-slate-600/50 text-xs">GMB Not Connected</Badge>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-xs bg-transparent border-slate-600/50 text-white/80 hover:bg-white/5 hover:border-slate-500"
              onClick={() => onNavigate('my-profile')}
            >
              Edit Profile
            </Button>
          </CardContent>
        </Card>

        {/* AI Action Center */}
        <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
          <div className="h-1 bg-gradient-to-r from-primary to-teal rounded-t-lg" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-teal/20">
                <Sparkles className="h-4 w-4 text-teal" />
              </div>
              AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {aiSuggestions.map((suggestion, index) => {
                if (!suggestion) return null;
                const Icon = suggestion.icon;
                return (
                  <div 
                    key={index}
                    className={`p-2.5 rounded-lg text-xs border transition-colors ${
                      suggestion.type === 'warning' 
                        ? 'bg-gold/10 border-gold/30 hover:bg-gold/15' 
                        : suggestion.type === 'action' 
                          ? 'bg-teal/10 border-teal/30 hover:bg-teal/15' 
                          : 'bg-slate-700/50 border-slate-600/50 hover:bg-slate-700/70'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`p-1 rounded ${
                        suggestion.type === 'warning' ? 'bg-gold/20' :
                        suggestion.type === 'action' ? 'bg-teal/20' :
                        'bg-slate-600/50'
                      }`}>
                        <Icon className={`h-3.5 w-3.5 ${
                          suggestion.type === 'warning' ? 'text-gold' :
                          suggestion.type === 'action' ? 'text-teal' :
                          'text-white/60'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{suggestion.title}</p>
                        <p className="text-white/50 text-[10px] mt-0.5">{suggestion.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start gap-2 text-xs bg-transparent border-teal/30 text-teal hover:bg-teal/10 hover:border-teal/50"
              onClick={() => onNavigate('my-review-requests')}
            >
              <Send className="h-3.5 w-3.5" />
              Send Review Request
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start gap-2 text-xs bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
              onClick={() => onNavigate('my-reviews')}
            >
              <QrCode className="h-3.5 w-3.5" />
              Generate QR Code
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start gap-2 text-xs bg-transparent border-purple/30 text-purple hover:bg-purple/10 hover:border-purple/50"
              onClick={() => onNavigate('my-services')}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Service
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start gap-2 text-xs bg-transparent border-gold/30 text-gold hover:bg-gold/10 hover:border-gold/50"
              onClick={() => onNavigate('my-appointments')}
            >
              <Eye className="h-3.5 w-3.5" />
              View All Bookings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
