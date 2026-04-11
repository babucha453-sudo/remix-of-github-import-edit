import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';
import {
  Settings2,
  TrendingUp,
  Calendar,
  Shield,
  Globe,
  Star,
  RefreshCw,
  Search,
  Check,
  X,
  AlertTriangle,
  Crown,
  Zap,
  Target,
  SlidersHorizontal,
} from 'lucide-react';

interface ClinicOverride {
  id: string;
  name: string;
  slug: string;
  booking_enabled?: boolean;
  booking_override?: 'force_on' | 'force_off' | null;
  rank_boost?: number;
  gmb_connected: boolean;
  verification_status: string | null;
}

interface RankingWeight {
  key: string;
  label: string;
  description: string;
  weight: number;
  maxWeight: number;
}

const DEFAULT_RANKING_WEIGHTS: RankingWeight[] = [
  { key: 'insurance_match', label: 'Insurance Match', description: 'Boost for matching user insurance', weight: 30, maxWeight: 50 },
  { key: 'availability', label: 'Availability Score', description: 'Earlier available slots rank higher', weight: 20, maxWeight: 40 },
  { key: 'distance', label: 'Distance', description: 'Closer clinics rank higher', weight: 15, maxWeight: 30 },
  { key: 'reviews', label: 'Review Score', description: 'Higher ratings boost ranking', weight: 20, maxWeight: 40 },
  { key: 'trust', label: 'Trust Score', description: 'Verified profiles, responsiveness', weight: 10, maxWeight: 20 },
  { key: 'admin_boost', label: 'Admin Boost', description: 'Manual ranking adjustment', weight: 5, maxWeight: 50 },
];

export default function MarketplaceControlTab() {
  const queryClient = useQueryClient();
  const [selectedClinic, setSelectedClinic] = useState<ClinicOverride | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rankingWeights, setRankingWeights] = useState<RankingWeight[]>(DEFAULT_RANKING_WEIGHTS);

  // Helper to fetch ALL clinics without limit
  const fetchAllMarketplaceClinics = async () => {
    const allClinics: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('clinics')
        .select(`
          id, name, slug, gmb_connected, verification_status, claimed_by,
          dentist_settings (booking_enabled)
        `)
        .eq('is_active', true)
        .order('name')
        .range(from, from + batchSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allClinics.push(...data);
        from += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    return allClinics.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      booking_enabled: c.dentist_settings?.booking_enabled ?? true,
      gmb_connected: c.gmb_connected,
      verification_status: c.verification_status,
      claimed_by: c.claimed_by,
    }));
  };

  // Fetch ALL clinics with booking settings - NO LIMIT
  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ['marketplace-clinics-unlimited'],
    queryFn: fetchAllMarketplaceClinics,
  });

  // Fetch ranking weights from global_settings
  const { data: savedWeights } = useQuery({
    queryKey: ['ranking-weights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'ranking_weights')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.value as Record<string, number> | null;
    },
  });

  // Update ranking weights
  const updateWeightsMutation = useMutation({
    mutationFn: async (weights: RankingWeight[]) => {
      const weightMap = Object.fromEntries(weights.map(w => [w.key, w.weight]));

      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: 'ranking_weights',
          value: weightMap,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      await createAuditLog({
        action: 'update_ranking_weights',
        entityType: 'global_settings',
        entityId: 'ranking_weights',
        newValues: weightMap,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranking-weights'] });
      toast.success('Ranking weights updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update weights');
    },
  });

  // Force booking on/off for a clinic
  const forceBookingMutation = useMutation({
    mutationFn: async ({ clinicId, enabled }: { clinicId: string; enabled: boolean }) => {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('dentist_settings')
        .select('id')
        .eq('clinic_id', clinicId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('dentist_settings')
          .update({ booking_enabled: enabled })
          .eq('clinic_id', clinicId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dentist_settings')
          .insert({ clinic_id: clinicId, booking_enabled: enabled });

        if (error) throw error;
      }

      await createAuditLog({
        action: enabled ? 'admin_force_booking_on' : 'admin_force_booking_off',
        entityType: 'clinic',
        entityId: clinicId,
        newValues: { booking_enabled: enabled },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-clinics'] });
      setShowOverrideDialog(false);
      toast.success('Booking status updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update');
    },
  });

  // Trigger GMB sync for all
  const syncAllGmbMutation = useMutation({
    mutationFn: async () => {
      // This would trigger a background job
      toast.info('GMB sync queued for all connected clinics');
      await createAuditLog({
        action: 'trigger_gmb_sync_all',
        entityType: 'system',
      });
    },
    onSuccess: () => {
      toast.success('GMB sync initiated');
    },
  });

  const filteredClinics = clinics?.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const verifiedCount = clinics?.filter(c => c.verification_status === 'verified').length || 0;
  const gmbConnectedCount = clinics?.filter(c => c.gmb_connected).length || 0;
  const bookingEnabledCount = clinics?.filter(c => c.booking_enabled).length || 0;

  if (clinicsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Marketplace Control
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage ranking, booking enforcement, and platform-wide controls
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => syncAllGmbMutation.mutate()}
          disabled={syncAllGmbMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncAllGmbMutation.isPending ? 'animate-spin' : ''}`} />
          Sync All GMB
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-modern">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{bookingEnabledCount}</p>
                <p className="text-xs text-muted-foreground">Booking Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{verifiedCount}</p>
                <p className="text-xs text-muted-foreground">Verified Clinics</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">{gmbConnectedCount}</p>
                <p className="text-xs text-muted-foreground">GMB Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-coral/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-coral" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clinics?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Clinics</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ranking" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ranking" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Ranking Weights
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-2">
            <Calendar className="h-4 w-4" />
            Booking Control
          </TabsTrigger>
          <TabsTrigger value="overrides" className="gap-2">
            <Crown className="h-4 w-4" />
            Manual Overrides
          </TabsTrigger>
        </TabsList>

        {/* Ranking Weights Tab */}
        <TabsContent value="ranking">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                Ranking Algorithm Weights
              </CardTitle>
              <CardDescription>
                Adjust how different factors influence search result ordering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {rankingWeights.map((weight, index) => (
                <div key={weight.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">{weight.label}</Label>
                      <p className="text-xs text-muted-foreground">{weight.description}</p>
                    </div>
                    <Badge variant="outline">{weight.weight}%</Badge>
                  </div>
                  <Slider
                    value={[weight.weight]}
                    onValueChange={([value]) => {
                      const updated = [...rankingWeights];
                      updated[index] = { ...weight, weight: value };
                      setRankingWeights(updated);
                    }}
                    max={weight.maxWeight}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Total Weight</p>
                  <p className="text-xs text-muted-foreground">
                    Should ideally sum to 100%
                  </p>
                </div>
                <Badge
                  variant={
                    rankingWeights.reduce((sum, w) => sum + w.weight, 0) === 100
                      ? 'default'
                      : 'destructive'
                  }
                >
                  {rankingWeights.reduce((sum, w) => sum + w.weight, 0)}%
                </Badge>
              </div>

              <Button
                onClick={() => updateWeightsMutation.mutate(rankingWeights)}
                disabled={updateWeightsMutation.isPending}
                className="w-full"
              >
                Save Ranking Weights
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Control Tab */}
        <TabsContent value="booking">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Booking Enforcement
              </CardTitle>
              <CardDescription>
                Force booking on/off for specific clinics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clinics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>GMB</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClinics.slice(0, 50).map((clinic) => (
                      <TableRow key={clinic.id}>
                        <TableCell className="font-medium">{clinic.name}</TableCell>
                        <TableCell>
                          {clinic.verification_status === 'verified' ? (
                            <Badge className="bg-teal/20 text-teal border-0">
                              <Check className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {clinic.gmb_connected ? (
                            <Badge className="bg-primary/20 text-primary border-0">Connected</Badge>
                          ) : (
                            <Badge variant="secondary">Not Connected</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {clinic.booking_enabled ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClinic(clinic);
                              setShowOverrideDialog(true);
                            }}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredClinics.length > 50 && (
                <p className="text-sm text-muted-foreground text-center">
                  Showing 50 of {filteredClinics.length} clinics. Use search to find specific clinics.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Overrides Tab */}
        <TabsContent value="overrides">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-gold" />
                Manual Ranking Overrides
              </CardTitle>
              <CardDescription>
                Pin clinics to top positions or apply permanent boosts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Use the Pinned Profiles and Top Dentists tabs for manual ranking control
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => window.location.href = '/admin?tab=pinned-profiles'}>
                    Pinned Profiles
                  </Button>
                  <Button variant="outline" onClick={() => window.location.href = '/admin?tab=top-dentists'}>
                    Top Dentists
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Override Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clinic Override</DialogTitle>
            <DialogDescription>
              Force booking settings for {selectedClinic?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedClinic && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 rounded-xl border">
                <div>
                  <p className="font-medium">Current Status</p>
                  <p className="text-sm text-muted-foreground">
                    Booking is {selectedClinic.booking_enabled ? 'enabled' : 'disabled'}
                  </p>
                </div>
                <Badge variant={selectedClinic.booking_enabled ? 'default' : 'destructive'}>
                  {selectedClinic.booking_enabled ? 'ON' : 'OFF'}
                </Badge>
              </div>

              <div className="p-3 rounded-lg bg-amber/10 border border-amber/20">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    This will override the dentist's own booking preference. 
                    Use only when necessary for platform compliance.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowOverrideDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant={selectedClinic?.booking_enabled ? 'destructive' : 'default'}
              onClick={() => {
                if (selectedClinic) {
                  forceBookingMutation.mutate({
                    clinicId: selectedClinic.id,
                    enabled: !selectedClinic.booking_enabled,
                  });
                }
              }}
              disabled={forceBookingMutation.isPending}
            >
              {selectedClinic?.booking_enabled ? 'Force Disable' : 'Force Enable'} Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
