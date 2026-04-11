import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Star,
  MessageSquare,
  Filter,
  FileText,
  AlertTriangle,
  Building2,
  Sparkles,
  Bell,
  ClipboardList,
  RefreshCw,
  Download,
  Settings,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
} from 'lucide-react';

// Sub-tab components
import ReputationOverviewTab from './tabs/ReputationOverviewTab';
import ReputationReviewsTab from './tabs/ReputationReviewsTab';
import ReputationRepliesTab from './tabs/ReputationRepliesTab';
import ReputationFunnelTab from './tabs/ReputationFunnelTab';
import ReputationSurveysTab from './tabs/ReputationSurveysTab';
import ReputationRiskTab from './tabs/ReputationRiskTab';
import ReputationProfilesTab from './tabs/ReputationProfilesTab';
import ReputationAITab from './tabs/ReputationAITab';
import ReputationAlertsTab from './tabs/ReputationAlertsTab';
import ReputationLogsTab from './tabs/ReputationLogsTab';

interface ReputationHubProps {
  clinicId?: string; // Optional - if provided, filter to single clinic (dentist view)
  isAdmin?: boolean; // SuperAdmin sees all clinics
}

export default function ReputationHub({ clinicId, isAdmin = false }: ReputationHubProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  // Sync Google Reviews
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('gmb-import', {
        body: { action: 'sync_reviews', clinicId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Review sync initiated');
      queryClient.invalidateQueries({ queryKey: ['google-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['reputation-kpis'] });
    },
    onError: (e: Error) => toast.error('Sync failed: ' + e.message),
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'replies', label: 'Replies', icon: MessageSquare },
    { id: 'funnel', label: 'Funnel', icon: Filter },
    { id: 'surveys', label: 'Surveys', icon: FileText },
    { id: 'risk', label: 'Risk', icon: AlertTriangle },
    { id: 'profiles', label: 'Profiles', icon: Building2 },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'logs', label: 'Logs', icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            Reputation Intelligence Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Platform-wide reputation management & governance' : 'Manage your practice reputation'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Reviews
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-12 items-center justify-start rounded-xl bg-muted/50 p-1.5 text-muted-foreground w-auto min-w-full lg:min-w-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <ReputationOverviewTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="reviews">
          <ReputationReviewsTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="replies">
          <ReputationRepliesTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="funnel">
          <ReputationFunnelTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="surveys">
          <ReputationSurveysTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="risk">
          <ReputationRiskTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="profiles">
          <ReputationProfilesTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="ai">
          <ReputationAITab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="alerts">
          <ReputationAlertsTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
        
        <TabsContent value="logs">
          <ReputationLogsTab clinicId={clinicId} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
