import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  TrendingUp, 
  TrendingDown, 
  Users,
  Calendar,
  Star,
  Download,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Mail,
  Phone,
  MessageSquare,
  Share2,
  DollarSign,
  Gift,
  PartyPopper,
  MousePointerClick,
  Eye
} from 'lucide-react';
import { useState } from 'react';

const StatCard = ({ 
  title, 
  value, 
  change, 
  changeType = 'neutral',
  icon: Icon,
  description 
}: {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: any;
  description?: string;
}) => (
  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              changeType === 'positive' ? 'text-emerald-600' : 
              changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {changeType === 'positive' ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : changeType === 'negative' ? (
                <ArrowDownRight className="h-4 w-4" />
              ) : null}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
          {description && (
            <p className="text-xs text-gray-400 mt-2">{description}</p>
          )}
        </div>
        <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Icon className="h-6 w-6 text-emerald-600" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function MarketingTab() {
  const { user } = useAuth();

  const clinicId = user?.id;

  const [activeCampaign, setActiveCampaign] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: clinic } = useQuery({
    queryKey: ['marketing-clinic', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('claimed_by', clinicId)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!clinicId,
  });

  const { data: leadRequests } = useQuery({
    queryKey: ['clinic-lead-requests', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_lead_requests')
        .select('*')
        .eq('clinic_id', clinic?.id);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: appointments } = useQuery({
    queryKey: ['clinic-appointments', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', clinic?.id);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: promoCodes } = useQuery({
    queryKey: ['promo-codes', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('clinic_id', clinic?.id);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: clinicImages } = useQuery({
    queryKey: ['clinic-images', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_images')
        .select('*')
        .eq('clinic_id', clinic?.id);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const totalLeads = leadRequests?.length || 0;
  const totalAppointments = appointments?.length || 0;
  const completedAppointments = appointments?.filter(a => a.status === 'completed').length || 0;
  const thisMonthLeads = leadRequests?.filter(l => {
    const created = new Date(l.created_at);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length || 0;

  if (!clinic) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No clinic linked to your account</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing & Growth</h1>
          <p className="text-gray-500 mt-1">Drive patient acquisition and retention</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PartyPopper className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={totalLeads}
          change={thisMonthLeads > 0 ? Math.round((thisMonthLeads / Math.max(totalLeads - thisMonthLeads, 1)) * 100) : undefined}
          changeType="neutral"
          icon={Users}
          description="All time lead requests"
        />
        <StatCard
          title="Appointments"
          value={totalAppointments}
          change={completedAppointments}
          changeType="neutral"
          icon={Calendar}
          description={`${completedAppointments} completed`}
        />
        <StatCard
          title="Profile Views"
          value={clinic?.profile_views || 0}
          change={undefined}
          changeType="neutral"
          icon={Eye}
          description="Total profile views"
        />
        <StatCard
          title="Photos"
          value={clinicImages?.length || 0}
          change={undefined}
          changeType="neutral"
          icon={Image}
          description="Clinic photos"
        />
      </div>

      {/* Campaigns */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Marketing Campaigns</CardTitle>
          <CardDescription>Track your marketing efforts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No campaigns yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first marketing campaign to reach patients</p>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Promotions */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Promo Codes</CardTitle>
            <CardDescription>Track your special offers</CardDescription>
          </CardHeader>
          <CardContent>
            {promoCodes && promoCodes.length > 0 ? (
              <div className="space-y-3">
                {promoCodes.map((promo) => (
                  <div key={promo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{promo.code}</p>
                      <p className="text-sm text-gray-500">{promo.discount_type === 'percentage' ? `${promo.discount_value}% off` : `$${promo.discount_value} off`}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{promo.uses_count || 0} uses</p>
                      <Badge className={promo.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
                        {promo.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Gift className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No promo codes yet</p>
                <p className="text-sm text-gray-400 mt-1">Create promo codes to attract new patients</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channels Performance */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Clinic Profile</CardTitle>
            <CardDescription>Your listing status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Profile Status</span>
                  <Badge className={clinic?.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                    {clinic?.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>{totalLeads} leads</span>
                  <span>{totalAppointments} appointments</span>
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Profile Completion</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>{clinicImages?.length || 0} photos</span>
                  <span>{clinic?.name ? 'Name set' : 'No name'}</span>
                  <span>{clinic?.description ? 'Description set' : 'No description'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Mail className="h-6 w-6 text-emerald-600" />
              <span className="text-sm">Send Email</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <MessageSquare className="h-6 w-6 text-emerald-600" />
              <span className="text-sm">Send SMS</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Share2 className="h-6 w-6 text-emerald-600" />
              <span className="text-sm">Share Profile</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Gift className="h-6 w-6 text-emerald-600" />
              <span className="text-sm">Create Promo</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}