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

  // Fetch clinic
  const { data: clinic } = useQuery({
    queryKey: ['marketing-clinic', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const [activeCampaign, setActiveCampaign] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const campaigns = [
    { id: 1, name: 'Spring Cleaning Special', status: 'active', sent: 1250, opens: 687, clicks: 124, conversions: 18, budget: 500 },
    { id: 2, name: 'New Patient Welcome', status: 'active', sent: 89, opens: 67, clicks: 23, conversions: 12, budget: 0 },
    { id: 3, name: 'Recall - 6 Month Checkup', status: 'scheduled', sent: 0, opens: 0, clicks: 0, conversions: 0, budget: 250 },
    { id: 4, name: 'Teeth Whitening Promo', status: 'completed', sent: 2500, opens: 1125, clicks: 312, conversions: 45, budget: 750 },
  ];

  const topPromotions = [
    { id: 1, name: 'New Patient Exam', code: 'NEW25', uses: 34, redemptionRate: 68 },
    { id: 2, name: 'Teeth Whitening', code: 'WHITE100', uses: 28, redemptionRate: 56 },
    { id: 3, name: 'Referral Bonus', code: 'REFER50', uses: 15, redemptionRate: 100 },
    { id: 4, name: 'Family Discount', code: 'FAMILY20', uses: 22, redemptionRate: 45 },
  ];

  const channels = [
    { name: 'Email', sent: 3839, delivered: 3756, opens: 1879, clicks: 459, conversions: 75, cost: 0 },
    { name: 'SMS', sent: 1245, delivered: 1198, opens: 892, clicks: 234, conversions: 45, cost: 125 },
    { name: 'Social', impressions: 45000, engagement: 2340, clicks: 567, conversions: 34, cost: 350 },
  ];

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
          title="Emails Sent"
          value="3,839"
          change={15}
          changeType="positive"
          icon={Mail}
          description="This month"
        />
        <StatCard
          title="Open Rate"
          value="50%"
          change={3}
          changeType="positive"
          icon={Eye}
          description="Industry avg: 21%"
        />
        <StatCard
          title="Conversions"
          value="154"
          change={-8}
          changeType="negative"
          icon={Target}
          description="From campaigns"
        />
        <StatCard
          title="Revenue"
          value="$12,450"
          change={22}
          changeType="positive"
          icon={DollarSign}
          description="Attributed revenue"
        />
      </div>

      {/* Campaigns */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Active Campaigns</CardTitle>
          <CardDescription>Track your marketing efforts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                    <Badge className={`mt-1 ${
                      campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      campaign.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{campaign.sent}</p>
                      <p className="text-gray-500">Sent</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{campaign.opens}</p>
                      <p className="text-gray-500">Opens</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{campaign.clicks}</p>
                      <p className="text-gray-500">Clicks</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-emerald-600">{campaign.conversions}</p>
                      <p className="text-gray-500">Booked</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Open rate: {campaign.sent > 0 ? Math.round((campaign.opens / campaign.sent) * 100) : 0}%</span>
                  <span>Click rate: {campaign.sent > 0 ? Math.round((campaign.clicks / campaign.sent) * 100) : 0}%</span>
                  {campaign.budget > 0 && <span>Budget: ${campaign.budget}</span>}
                </div>
              </div>
            ))}
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
            <div className="space-y-3">
              {topPromotions.map((promo) => (
                <div key={promo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{promo.name}</p>
                    <code className="text-sm text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{promo.code}</code>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{promo.uses} uses</p>
                    <p className="text-sm text-gray-500">{promo.redemptionRate}% redeemed</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Channels Performance */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Channel Performance</CardTitle>
            <CardDescription>Compare marketing channels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {channels.map((channel, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{channel.name}</span>
                    <span className="text-sm text-emerald-600">${channel.cost}</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    {channel.sent !== undefined && <span>{channel.sent} sent</span>}
                    {channel.impressions !== undefined && <span>{channel.impressions.toLocaleString()} impressions</span>}
                    <span className="text-gray-500">{channel.clicks} clicks</span>
                    <span className="text-emerald-600">{channel.conversions} conversions</span>
                  </div>
                </div>
              ))}
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