import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  Flag, 
  Calendar, 
  Link2, 
  Shield, 
  Search, 
  Sparkles, 
  Star,
  RefreshCw,
  Info,
  History,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  category: 'booking' | 'search' | 'ai' | 'integrations' | 'reviews';
  icon: typeof Flag;
  defaultValue: boolean;
}

// Define all feature flags for booking engine functionality
const FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'booking_engine_enabled',
    name: 'Real-Time Booking Engine',
    description: 'Enable slot-based calendar booking with availability rules and lock system',
    category: 'booking',
    icon: Calendar,
    defaultValue: false,
  },
  {
    key: 'booking_default_on',
    name: 'Booking Default ON',
    description: 'New clinics have booking enabled by default. Dentists can opt-out from dashboard.',
    category: 'booking',
    icon: Zap,
    defaultValue: true,
  },
  {
    key: 'gbp_appointment_sync_enabled',
    name: 'GBP Appointment Link Sync',
    description: 'Sync "Book Online" button to Google Business Profiles automatically',
    category: 'integrations',
    icon: Link2,
    defaultValue: true,
  },
  {
    key: 'insurance_filter_enabled',
    name: 'Insurance-First Search',
    description: 'Enable insurance filtering and matching in search results',
    category: 'search',
    icon: Shield,
    defaultValue: true,
  },
  {
    key: 'ai_match_enabled',
    name: 'AI Dentist Matching',
    description: 'AI-powered dentist recommendations based on user needs and preferences',
    category: 'ai',
    icon: Sparkles,
    defaultValue: false,
  },
  {
    key: 'review_ai_summary_enabled',
    name: 'AI Review Summaries',
    description: 'Generate AI summaries of patient reviews for dentist profiles',
    category: 'reviews',
    icon: Star,
    defaultValue: false,
  },
];

const categoryConfig = {
  booking: { label: 'Booking', color: 'bg-primary/20 text-primary' },
  search: { label: 'Search', color: 'bg-teal/20 text-teal' },
  ai: { label: 'AI Features', color: 'bg-purple-500/20 text-purple-500' },
  integrations: { label: 'Integrations', color: 'bg-amber/20 text-amber' },
  reviews: { label: 'Reviews', color: 'bg-coral/20 text-coral' },
};

export default function FeatureFlagsTab() {
  const queryClient = useQueryClient();
  const [updatingFlags, setUpdatingFlags] = useState<Set<string>>(new Set());

  // Fetch current flag values from global_settings
  const { data: flagValues, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('key, value')
        .like('key', 'feature_%');

      if (error) throw error;

      const flags: Record<string, boolean> = {};
      
      // Initialize with defaults
      FEATURE_FLAGS.forEach(flag => {
        flags[flag.key] = flag.defaultValue;
      });

      // Override with stored values
      data?.forEach(setting => {
        const flagKey = setting.key.replace('feature_', '');
        if (typeof setting.value === 'object' && setting.value !== null && 'enabled' in setting.value) {
          flags[flagKey] = (setting.value as { enabled: boolean }).enabled;
        }
      });

      return flags;
    },
  });

  // Mutation to toggle a flag
  const toggleFlag = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const settingKey = `feature_${key}`;
      const oldValue = flagValues?.[key] ?? false;

      // Upsert the setting
      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: settingKey,
          value: { enabled },
          description: FEATURE_FLAGS.find(f => f.key === key)?.description,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (error) throw error;

      // Create audit log
      await createAuditLog({
        action: 'FEATURE_FLAG_TOGGLE',
        entityType: 'feature_flag',
        entityId: key,
        oldValues: { enabled: oldValue },
        newValues: { enabled },
      });

      return { key, enabled };
    },
    onMutate: ({ key }) => {
      setUpdatingFlags(prev => new Set(prev).add(key));
    },
    onSuccess: ({ key, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      const flag = FEATURE_FLAGS.find(f => f.key === key);
      toast.success(`${flag?.name} ${enabled ? 'enabled' : 'disabled'}`, {
        description: 'Change logged to audit trail',
      });
    },
    onError: (error: Error, { key }) => {
      toast.error('Failed to update flag', { description: error.message });
    },
    onSettled: (_, __, { key }) => {
      setUpdatingFlags(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
  });

  const handleToggle = (key: string, currentValue: boolean) => {
    toggleFlag.mutate({ key, enabled: !currentValue });
  };

  // Group flags by category
  const groupedFlags = FEATURE_FLAGS.reduce((acc, flag) => {
    if (!acc[flag.category]) {
      acc[flag.category] = [];
    }
    acc[flag.category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const enabledCount = Object.values(flagValues || {}).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Flag className="h-8 w-8 text-primary" />
            Feature Flags
          </h1>
          <p className="text-muted-foreground mt-1">
            Control platform features with safe rollout toggles
          </p>
        </div>
        <div className="text-right">
          <Badge className="bg-teal/20 text-teal">
            {enabledCount} / {FEATURE_FLAGS.length} Active
          </Badge>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Safe Feature Rollout</p>
              <p className="text-muted-foreground">
                All new booking engine features are behind these flags. Enable them individually to test before full rollout.
                All changes are logged to the audit trail.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flags by Category */}
      <div className="grid lg:grid-cols-2 gap-6">
        {Object.entries(groupedFlags).map(([category, flags]) => (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge className={categoryConfig[category as keyof typeof categoryConfig].color}>
                  {categoryConfig[category as keyof typeof categoryConfig].label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {flags.map(flag => {
                const Icon = flag.icon;
                const isEnabled = flagValues?.[flag.key] ?? flag.defaultValue;
                const isUpdating = updatingFlags.has(flag.key);

                return (
                  <div
                    key={flag.key}
                    className={`p-4 rounded-lg border transition-colors ${
                      isEnabled ? 'bg-teal/5 border-teal/30' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isEnabled ? 'bg-teal/20' : 'bg-muted'}`}>
                          <Icon className={`h-4 w-4 ${isEnabled ? 'text-teal' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{flag.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                          <code className="text-[10px] bg-muted px-1 py-0.5 rounded mt-2 inline-block">
                            {flag.key}
                          </code>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isUpdating && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => handleToggle(flag.key, isEnabled)}
                          disabled={isUpdating}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bulk Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              FEATURE_FLAGS.forEach(flag => {
                if (!flagValues?.[flag.key]) {
                  toggleFlag.mutate({ key: flag.key, enabled: true });
                }
              });
            }}
            disabled={toggleFlag.isPending}
          >
            Enable All
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              FEATURE_FLAGS.forEach(flag => {
                if (flagValues?.[flag.key]) {
                  toggleFlag.mutate({ key: flag.key, enabled: false });
                }
              });
            }}
            disabled={toggleFlag.isPending}
          >
            Disable All
          </Button>
          <Button
            variant="ghost"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['feature-flags'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Audit Trail Link */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">View Change History</p>
                <p className="text-xs text-muted-foreground">All flag changes are logged in Audit Logs</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin?tab=audit">View Audit Logs</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
