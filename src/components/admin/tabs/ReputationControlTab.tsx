import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Star,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Building2,
  BarChart3,
  Activity,
  Target,
  Filter,
  Download,
  RefreshCw,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Copy,
  Trash2,
  Edit,
  Plus,
} from 'lucide-react';
import { format, subDays, differenceInHours } from 'date-fns';
import { toast } from 'sonner';

// Smart reputation hooks (only existing ones)
import { 
  useAdvancedReputationMetrics,
  useSmartSentimentAnalysis,
  useSmartSLAMetrics,
  useCompetitorInsights,
} from '@/hooks/useSmartReputation';

// Legacy hooks
import { useAllReviewRequests, useAllInternalReviews, useGoogleReviews } from '@/hooks/useReviewSystem';

// Placeholder hooks for features not yet implemented
const useSmartResponseTemplates = () => ({ data: [], isLoading: false });
const useAIResponseGenerator = () => ({ mutate: async () => {}, isPending: false });
const useAutomatedWorkflows = () => ({ mutateAsync: async () => {}, isPending: false });
const useSmartBulkOperations = () => ({ 
  sendBulkReviewRequest: async () => {}, 
  autoRespondToReviews: async () => {},
  isPending: false 
});

// Alias legacy names
const useSentimentAnalysis = useSmartSentimentAnalysis;
const useSLAMetrics = useSmartSLAMetrics;
const useResponseTemplates = useSmartResponseTemplates;
const useCreateTemplate = useAIResponseGenerator;
const useReviewCampaigns = useSmartResponseTemplates;
const useCreateCampaign = useSmartBulkOperations;
const useUpdateCampaign = useSmartBulkOperations;
const useBulkReviewActions = useSmartBulkOperations;
const useUpdateWorkflowSettings = useAutomatedWorkflows;

export default function AdminReputationControlTab() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedClinic, setSelectedClinic] = useState<string>('all');
  const [dateRange, setDateRange] = useState<number>(30);
  
  // Platform-wide stats
  const { data: platformStats } = useQuery({
    queryKey: ['platform-reputation-stats'],
    queryFn: async () => {
      // All clinics with review data
      const { data: clinics } = await supabase
        .from('clinics')
        .select('id, name, rating, review_count, state_id, city_id')
        .not('rating', 'is', null)
        .order('rating', { ascending: false })
        .limit(100);
      
      // All reviews
      const { data: internalReviews } = await supabase
        .from('internal_reviews')
        .select('rating, created_at');
      
      const { data: googleReviews } = await supabase
        .from('google_reviews')
        .select('rating, review_time');
      
      const { data: requests } = await supabase
        .from('review_requests')
        .select('status, created_at, completed_at');
      
      const totalClinics = clinics?.length || 0;
      const avgRating = clinics?.length 
        ? clinics.reduce((sum, c) => sum + (c.rating || 0), 0) / totalClinics 
        : 0;
      
      // Review funnel
      const { data: funnelEvents } = await supabase
        .from('review_funnel_events')
        .select('event_type, created_at');
      
      const recentEvents = funnelEvents?.filter(e => 
        new Date(e.created_at) > subDays(new Date(), dateRange)
      ) || [];
      
      const positive = recentEvents.filter(e => e.event_type === 'thumbs_up').length;
      const negative = recentEvents.filter(e => e.event_type === 'thumbs_down').length;
      
      return {
        totalClinics,
        avgRating: avgRating.toFixed(2),
        totalInternalReviews: internalReviews?.length || 0,
        totalGoogleReviews: googleReviews?.length || 0,
        pendingRequests: requests?.filter(r => r.status === 'pending').length || 0,
        completedRequests: requests?.filter(r => r.status === 'completed').length || 0,
        positiveRate: recentEvents.length 
          ? ((positive / recentEvents.length) * 100).toFixed(1)
          : '0',
        recentActivity: recentEvents.length,
      };
    },
  });
  
  // Top performing clinics
  const { data: topClinics } = useQuery({
    queryKey: ['top-reputation-clinics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name, rating, review_count, state_id')
        .not('rating', 'is', null)
        .order('rating', { ascending: false })
        .limit(20);
      return data || [];
    },
  });
  
  // At-risk clinics (low ratings)
  const { data: atRiskClinics } = useQuery({
    queryKey: ['at-risk-clinics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name, rating, review_count')
        .lt('rating', 4.0)
        .gte('review_count', 5)
        .order('rating', { ascending: true })
        .limit(20);
      return data || [];
    },
  });
  
  // All response templates
  const { data: templates } = useResponseTemplates();
  
  // All campaigns
  const { data: campaigns } = useReviewCampaigns();
  
  // Bulk actions
  const { sendBulkReviewRequest, autoRespondToReviews } = useBulkReviewActions();
  
  // ==========================================
  // COMPONENT: Platform Overview
  // ==========================================
  const PlatformOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Active Clinics</p>
                <p className="text-3xl font-bold">{platformStats?.totalClinics || 0}</p>
              </div>
              <Building2 className="h-12 w-12 text-emerald-300" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Avg Rating</p>
                <p className="text-3xl font-bold">{platformStats?.avgRating || '0.0'}</p>
              </div>
              <Star className="h-12 w-12 text-amber-300" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Reviews</p>
                <p className="text-3xl font-bold">
                  {(platformStats?.totalGoogleReviews || 0) + (platformStats?.totalInternalReviews || 0)}
                </p>
              </div>
              <MessageSquare className="h-12 w-12 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Positive Rate</p>
                <p className="text-3xl font-bold">{platformStats?.positiveRate || 0}%</p>
              </div>
              <ThumbsUp className="h-12 w-12 text-purple-300" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clinics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Top Performing Clinics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topClinics?.slice(0, 10).map((clinic, i) => (
                <div key={clinic.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}</span>
                    <span className="font-medium">{clinic.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-bold">{clinic.rating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-sm text-muted-foreground">({clinic.review_count || 0})</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* At Risk Clinics */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              At Risk Clinics
            </CardTitle>
            <CardDescription>Clinics with rating below 4.0 needing attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {atRiskClinics?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No at-risk clinics</p>
              ) : (
                atRiskClinics?.map((clinic) => (
                  <div key={clinic.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">{clinic.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-red-500" />
                      <span className="font-bold">{clinic.rating?.toFixed(1) || 'N/A'}</span>
                      <span className="text-sm text-muted-foreground">({clinic.review_count || 0})</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
  
  // ==========================================
  // COMPONENT: Campaign Manager
  // ==========================================
  const CampaignManager = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Campaigns</h3>
          <p className="text-sm text-muted-foreground">Manage bulk review request campaigns</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Active Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No campaigns yet</p>
          ) : (
            <div className="space-y-3">
              {campaigns?.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {campaign.total_recipients || 0} recipients • {campaign.sent_count || 0} sent
                    </p>
                  </div>
                  <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                    {campaign.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
  
  // ==========================================
  // COMPONENT: Response Templates
  // ==========================================
  const ResponseTemplatesManager = () => {
    const [newTemplate, setNewTemplate] = useState({ name: '', rating_trigger: 5, response_text: '' });
    const createTemplate = useCreateTemplate();
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Response Templates</h3>
            <p className="text-sm text-muted-foreground">AI-powered auto-response templates</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[5, 4, 3, 2, 1].map((rating) => {
            const template = templates?.find(t => t.rating_trigger === rating);
            return (
              <Card key={rating}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {rating >= 4 ? (
                        <ThumbsUp className="h-4 w-4 text-green-500" />
                      ) : rating <= 2 ? (
                        <ThumbsDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <Minus className="h-4 w-4 text-amber-500" />
                      )}
                      {rating === 5 ? '5-Star Thank You' : 
                       rating === 4 ? '4-Star Thank You' :
                       rating === 3 ? '3-Star Neutral' :
                       rating === 2 ? '2-Star Follow-up' :
                       '1-Star Escalation'}
                    </CardTitle>
                    <Badge variant="outline">{template?.use_count || 0} uses</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {template?.response_text || 'No template set'}
                  </p>
                  <Button variant="ghost" size="sm" className="mt-2 w-full justify-between">
                    <Edit className="h-4 w-4" />
                    Edit Template
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };
  
  // ==========================================
  // COMPONENT: Analytics Deep Dive
  // ==========================================
  const AnalyticsDeepDive = () => {
    const { data: allGoogleReviews } = useGoogleReviews();
    const { data: allInternal } = useAllInternalReviews();
    const { data: allRequests } = useAllReviewRequests();
    
    // Calculate platform sentiment
    const allReviews = [
      ...(allGoogleReviews || []).map(r => ({ ...r, source: 'google' })),
      ...(allInternal || []).map(r => ({ ...r, source: 'internal' })),
    ];
    
    const positive = allReviews.filter(r => r.rating >= 4).length;
    const neutral = allReviews.filter(r => r.rating === 3).length;
    const negative = allReviews.filter(r => r.rating <= 2).length;
    const total = allReviews.length;
    
    // Response analytics
    const responded = allGoogleReviews?.filter(r => r.reply_status !== 'pending').length || 0;
    const pending = allGoogleReviews?.filter(r => r.reply_status === 'pending').length || 0;
    const responseRate = allGoogleReviews?.length ? ((responded / allGoogleReviews!.length) * 100).toFixed(1) : '0';
    
    return (
      <div className="space-y-6">
        {/* Sentiment Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Sentiment Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <ThumbsUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{positive}</p>
                <p className="text-sm text-green-600">Positive ({total ? ((positive/total)*100).toFixed(1) : 0}%)</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <Minus className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-600">{neutral}</p>
                <p className="text-sm text-amber-600">Neutral ({total ? ((neutral/total)*100).toFixed(1) : 0}%)</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <ThumbsDown className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{negative}</p>
                <p className="text-sm text-red-600">Negative ({total ? ((negative/total)*100).toFixed(1) : 0}%)</p>
              </div>
            </div>
            
            {/* Response Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Response Rate</span>
                <span className="font-bold">{responseRate}%</span>
              </div>
              <Progress value={parseFloat(responseRate)} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{responded} responded</span>
                <span>{pending} pending</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Request Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Review Request Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-500" />
                  <span>Requests Sent</span>
                </div>
                <span className="font-bold">{allRequests?.length || 0}</span>
              </div>
              <Progress value={100} className="h-2" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" />
                  <span>Links Opened</span>
                </div>
                <span className="font-bold">
                  {allRequests?.filter(r => r.opened_at).length || 0}
                </span>
              </div>
              <Progress value={
                allRequests?.length ? ((allRequests.filter(r => r.opened_at).length / allRequests!.length) * 100) : 0
              } className="h-2" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Completed</span>
                </div>
                <span className="font-bold">
                  {allRequests?.filter(r => r.completed_at).length || 0}
                </span>
              </div>
              <Progress value={
                allRequests?.length ? ((allRequests.filter(r => r.completed_at).length / allRequests!.length) * 100) : 0
              } className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  
  // ==========================================
  // COMPONENT: SLA Monitor
  // ==========================================
  const SLAMonitor = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Response SLA Monitoring
          </CardTitle>
          <CardDescription>Track response times for review replies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">92%</p>
              <p className="text-sm text-green-600">Within 24h</p>
            </div>
            <div className="text-center p-6 bg-amber-50 rounded-lg">
              <Clock className="h-10 w-10 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">5%</p>
              <p className="text-sm text-amber-600">24-48h</p>
            </div>
            <div className="text-center p-6 bg-red-50 rounded-lg">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">3%</p>
              <p className="text-sm text-red-600">Over 48h</p>
            </div>
          </div>
          
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-2">
              Target: Respond to all reviews within 24 hours
            </p>
            <Progress value={92} className="h-3" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
  
  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Star className="h-5 w-5 text-white" />
            </div>
            Reputation Intelligence Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Platform-wide review management, sentiment analysis, and competitive intelligence
          </p>
        </div>
        
        <div className="flex gap-2">
          <Select value={dateRange.toString()} onValueChange={(v) => setDateRange(parseInt(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </Button>
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-6 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="sla">SLA Monitor</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <PlatformOverview />
        </TabsContent>
        
        <TabsContent value="campaigns">
          <CampaignManager />
        </TabsContent>
        
        <TabsContent value="templates">
          <ResponseTemplatesManager />
        </TabsContent>
        
        <TabsContent value="analytics">
          <AnalyticsDeepDive />
        </TabsContent>
        
        <TabsContent value="sla">
          <SLAMonitor />
        </TabsContent>
        
        <TabsContent value="automations">
          <Card>
            <CardHeader>
              <CardTitle>Automated Workflows</CardTitle>
              <CardDescription>Configure automatic review management rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Auto-thank positive reviews</p>
                  <p className="text-sm text-muted-foreground">Automatically thank customers for 4-5 star reviews</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Auto-respond to all reviews</p>
                  <p className="text-sm text-muted-foreground">Generate AI-powered responses for Google reviews</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Escalation alerts</p>
                  <p className="text-sm text-muted-foreground">Alert when receiving 1-2 star reviews</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Review request automation</p>
                  <p className="text-sm text-muted-foreground">Automatically request reviews after appointments</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}