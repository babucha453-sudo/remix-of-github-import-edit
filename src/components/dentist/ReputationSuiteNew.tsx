import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Settings,
  Star,
  Send,
  QrCode,
  FileText,
  Activity,
  Bell,
  History,
  Building2,
  Shield,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import all tab components
import ReputationOverviewTab from './reputation/ReputationOverviewTab';
import ReputationSetupTab from './reputation/ReputationSetupTab';
import ReputationQRCodesTab from './reputation/ReputationQRCodesTab';
import ReputationSurveysTab from './reputation/ReputationSurveysTab';
import ReputationScoreTab from './reputation/ReputationScoreTab';
import ReputationAlertsTab from './reputation/ReputationAlertsTab';
import ReputationReviewRequestsTab from './reputation/ReputationReviewRequestsTab';
import ReputationLogsHistoryTab from './reputation/ReputationLogsHistoryTab';
import { NoPracticeLinked } from './NoPracticeLinked';
import QRCodeGenerator from './QRCodeGenerator';
import { toast } from 'sonner';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Reputation snapshot' },
  { id: 'setup', label: 'Setup', icon: Settings, description: 'Configure integrations' },
  { id: 'requests', label: 'Review Requests', icon: Send, description: 'Send & track requests' },
  { id: 'qr-codes', label: 'QR Codes', icon: QrCode, description: 'In-clinic collection' },
  { id: 'surveys', label: 'Surveys', icon: FileText, description: 'Private feedback' },
  { id: 'score', label: 'Score', icon: Activity, description: 'Performance metrics' },
  { id: 'alerts', label: 'Alerts', icon: Bell, description: 'Insights & warnings' },
  { id: 'logs', label: 'History', icon: History, description: 'Activity timeline' },
];

export default function ReputationSuiteNew() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // Fetch clinic - skip for admins
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['reputation-suite-clinic', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug, google_place_id, rating, review_count')
        .eq('claimed_by', user?.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !isAdmin && !isSuperAdmin,
  });

  // Handler functions for Overview tab
  const handleSendRequest = () => {
    setActiveTab('requests');
  };

  const handleOpenQR = () => {
    setQrDialogOpen(true);
  };

  const handleSync = async () => {
    if (!clinic?.google_place_id) {
      toast.error('Please configure Google Business Profile first');
      setActiveTab('setup');
      return;
    }
    toast.info('Sync initiated. Reviews will update shortly.');
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  // Allow admins to proceed without a clinic
  if (!clinic && !isAdmin && !isSuperAdmin) {
    return <NoPracticeLinked />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg shadow-primary/30">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Reputation Suite</h1>
              <p className="text-white/60 text-sm">Enterprise reputation management</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Powered
            </Badge>
            {clinic.rating && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                <Star className="h-3 w-3 mr-1 fill-current" />
                {clinic.rating.toFixed(1)} Rating
              </Badge>
            )}
          </div>
        </div>

        <div className="relative flex gap-3">
          <Button
            variant="outline"
            className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={handleOpenQR}
          >
            <QrCode className="h-4 w-4" />
            QR Code
          </Button>
          <Button
            className="gap-2 bg-gradient-to-r from-primary to-teal text-white shadow-lg shadow-primary/30"
            onClick={handleSendRequest}
          >
            <Send className="h-4 w-4" />
            Send Request
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-2 -mb-2">
          <TabsList className="inline-flex h-auto bg-muted/50 p-1.5 rounded-xl border gap-1 w-auto min-w-full md:min-w-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                  'data-[state=active]:bg-background data-[state=active]:shadow-sm',
                  'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground'
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden md:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab Contents */}
        <TabsContent value="overview" className="mt-0">
          <ReputationOverviewTab
            clinicId={clinic.id}
            clinicName={clinic.name}
            googlePlaceId={clinic.google_place_id}
            rating={clinic.rating || undefined}
            reviewCount={clinic.review_count || undefined}
            onSendRequest={handleSendRequest}
            onOpenQR={handleOpenQR}
            onSync={handleSync}
          />
        </TabsContent>

        <TabsContent value="setup" className="mt-0">
          <ReputationSetupTab
            clinicId={clinic.id}
            clinicName={clinic.name}
            googlePlaceId={clinic.google_place_id}
          />
        </TabsContent>

        <TabsContent value="requests" className="mt-0">
          <ReputationReviewRequestsTab
            clinicId={clinic.id}
            clinicName={clinic.name}
            clinicSlug={clinic.slug}
            googlePlaceId={clinic.google_place_id}
          />
        </TabsContent>

        <TabsContent value="qr-codes" className="mt-0">
          <ReputationQRCodesTab
            clinicId={clinic.id}
            clinicName={clinic.name}
            clinicSlug={clinic.slug}
          />
        </TabsContent>

        <TabsContent value="surveys" className="mt-0">
          <ReputationSurveysTab clinicId={clinic.id} clinicName={clinic.name} />
        </TabsContent>

        <TabsContent value="score" className="mt-0">
          <ReputationScoreTab
            clinicId={clinic.id}
            rating={clinic.rating}
            reviewCount={clinic.review_count}
          />
        </TabsContent>

        <TabsContent value="alerts" className="mt-0">
          <ReputationAlertsTab clinicId={clinic.id} rating={clinic.rating || undefined} />
        </TabsContent>

        <TabsContent value="logs" className="mt-0">
          <ReputationLogsHistoryTab clinicId={clinic.id} />
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Review QR Code Studio
            </DialogTitle>
          </DialogHeader>
          <QRCodeGenerator
            clinicName={clinic.name}
            clinicSlug={clinic.slug}
            clinicId={clinic.id}
            googlePlaceId={clinic.google_place_id || undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
