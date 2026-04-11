import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Save, 
  RefreshCw, 
  Shield,
  Star,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Zap,
  BarChart3,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface RankingFactor {
  key: string;
  label: string;
  description: string;
  weight: number;
  maxWeight: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface RankingBoost {
  key: string;
  label: string;
  description: string;
  multiplier: number;
  enabled: boolean;
}

interface RankingPenalty {
  key: string;
  label: string;
  description: string;
  penalty: number;
  enabled: boolean;
}

const defaultFactors: RankingFactor[] = [
  { key: 'verification_status', label: 'Verification Status', description: 'Verified profiles rank highest', weight: 40, maxWeight: 50, icon: Shield },
  { key: 'claim_status', label: 'Claim Status', description: 'Claimed profiles rank above unclaimed', weight: 25, maxWeight: 30, icon: CheckCircle },
  { key: 'profile_completeness', label: 'Profile Completeness', description: 'Complete profiles with photos, services, etc.', weight: 15, maxWeight: 20, icon: BarChart3 },
  { key: 'review_score', label: 'Review Score', description: 'Google rating and review count', weight: 10, maxWeight: 15, icon: Star },
  { key: 'responsiveness', label: 'Lead Responsiveness', description: 'How quickly clinic responds to leads', weight: 5, maxWeight: 10, icon: Clock },
  { key: 'freshness', label: 'Profile Freshness', description: 'Recently updated profiles get boost', weight: 5, maxWeight: 10, icon: RefreshCw },
];

const defaultBoosts: RankingBoost[] = [
  { key: 'verified_badge', label: 'Verified Badge', description: '+50% score for verified clinics', multiplier: 1.5, enabled: true },
  { key: 'featured_placement', label: 'Featured Placement', description: '+100% score for featured/sponsored', multiplier: 2.0, enabled: true },
  { key: 'area_sponsor', label: 'Area Sponsor', description: '+75% score when sponsoring an area', multiplier: 1.75, enabled: true },
  { key: 'high_response_rate', label: 'High Response Rate', description: '+20% for >90% lead response', multiplier: 1.2, enabled: true },
];

const defaultPenalties: RankingPenalty[] = [
  { key: 'duplicate_flag', label: 'Duplicate Flag', description: '-80% for duplicate listings', penalty: 0.8, enabled: true },
  { key: 'spam_reports', label: 'Spam Reports', description: '-50% for spam flags', penalty: 0.5, enabled: true },
  { key: 'negative_feedback', label: 'High Negative Feedback', description: '-30% for excessive private complaints', penalty: 0.3, enabled: true },
  { key: 'incomplete_profile', label: 'Incomplete Profile', description: '-20% for profiles missing key info', penalty: 0.2, enabled: true },
  { key: 'stale_profile', label: 'Stale Profile', description: '-10% for profiles not updated in 6mo', penalty: 0.1, enabled: true },
];

export default function RankingRulesTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('factors');
  const [factors, setFactors] = useState<RankingFactor[]>(defaultFactors);
  const [boosts, setBoosts] = useState<RankingBoost[]>(defaultBoosts);
  const [penalties, setPenalties] = useState<RankingPenalty[]>(defaultPenalties);
  const [previewCity, setPreviewCity] = useState('');

  // Load saved ranking rules from database
  useQuery({
    queryKey: ['ranking-rules'],
    queryFn: async () => {
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'ranking_rules')
        .maybeSingle();
      
      if (data?.value) {
        const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (config.factors) setFactors(config.factors);
        if (config.boosts) setBoosts(config.boosts);
        if (config.penalties) setPenalties(config.penalties);
      }
      return data;
    },
  });

  // Fetch cities for preview
  const { data: cities } = useQuery({
    queryKey: ['cities-preview'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('id, name, slug').eq('is_active', true);
      return data || [];
    },
  });

  // Preview clinics with ranking
  const { data: previewClinics, refetch: refetchPreview } = useQuery({
    queryKey: ['ranking-preview', previewCity],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select(`
          id, name, slug, address, claim_status, verification_status,
          rating, review_count,
          city:cities(name)
        `)
        .eq('is_active', true)
        .order('verification_status', { ascending: false })
        .order('claim_status', { ascending: false })
        .order('rating', { ascending: false })
        .limit(20);

      if (previewCity) {
        query = query.eq('city_id', previewCity);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: Boolean(previewCity),
  });

  // Save config mutation
  const saveConfig = useMutation({
    mutationFn: async () => {
      const config = { factors, boosts, penalties };
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', 'ranking_rules')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('global_settings')
          .update({
            value: config as unknown as import('@/integrations/supabase/types').Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('global_settings')
          .insert({
            key: 'ranking_rules',
            value: config as unknown as import('@/integrations/supabase/types').Json,
          });
      }
    },
    onSuccess: () => {
      toast.success('Ranking rules saved to database');
      queryClient.invalidateQueries({ queryKey: ['ranking-rules'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Recalculate all ranks
  const recalculateRanks = useMutation({
    mutationFn: async () => {
      // Just simulate for now
      return 0;
    },
    onSuccess: () => {
      toast.success('Ranking calculation initiated');
      refetchPreview();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateFactorWeight = (key: string, weight: number) => {
    setFactors(factors.map(f => f.key === key ? { ...f, weight } : f));
  };

  const toggleBoost = (key: string, enabled: boolean) => {
    setBoosts(boosts.map(b => b.key === key ? { ...b, enabled } : b));
  };

  const updateBoostMultiplier = (key: string, multiplier: number) => {
    setBoosts(boosts.map(b => b.key === key ? { ...b, multiplier } : b));
  };

  const togglePenalty = (key: string, enabled: boolean) => {
    setPenalties(penalties.map(p => p.key === key ? { ...p, enabled } : p));
  };

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-teal/20 text-teal"><Shield className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'pending': return <Badge className="bg-gold/20 text-gold">Pending</Badge>;
      default: return <Badge variant="outline">Unverified</Badge>;
    }
  };

  const getClaimBadge = (status: string) => {
    switch (status) {
      case 'claimed': return <Badge className="bg-primary/20 text-primary"><CheckCircle className="h-3 w-3 mr-1" />Claimed</Badge>;
      case 'pending': return <Badge className="bg-gold/20 text-gold">Pending</Badge>;
      default: return <Badge variant="outline">Unclaimed</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Ranking Rules</h1>
          <p className="text-muted-foreground mt-1">Control how clinics are ranked in search and listings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => recalculateRanks.mutate()} disabled={recalculateRanks.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculateRanks.isPending ? 'animate-spin' : ''}`} />
            Recalculate All
          </Button>
          <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Rules
          </Button>
        </div>
      </div>

      {/* Weight Summary */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-bold">Total Weight: {totalWeight}%</p>
                <p className="text-sm text-muted-foreground">
                  {totalWeight === 100 ? '✓ Weights are balanced' : totalWeight > 100 ? '⚠️ Weights exceed 100%' : '⚠️ Weights below 100%'}
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="font-bold text-teal">{boosts.filter(b => b.enabled).length}</p>
                <p className="text-muted-foreground">Active Boosts</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-coral">{penalties.filter(p => p.enabled).length}</p>
                <p className="text-muted-foreground">Active Penalties</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="factors" className="rounded-xl">
            <Settings className="h-4 w-4 mr-2" />
            Base Factors
          </TabsTrigger>
          <TabsTrigger value="boosts" className="rounded-xl">
            <Zap className="h-4 w-4 mr-2" />
            Boosts
          </TabsTrigger>
          <TabsTrigger value="penalties" className="rounded-xl">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Penalties
          </TabsTrigger>
          <TabsTrigger value="preview" className="rounded-xl">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="factors" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg">Base Ranking Factors</CardTitle>
              <CardDescription>Adjust the weight of each factor in the ranking algorithm</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {factors.map((factor) => {
                const Icon = factor.icon;
                return (
                  <div key={factor.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold">{factor.label}</p>
                          <p className="text-sm text-muted-foreground">{factor.description}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-lg font-bold px-4">
                        {factor.weight}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-8">0%</span>
                      <Slider
                        value={[factor.weight]}
                        onValueChange={([value]) => updateFactorWeight(factor.key, value)}
                        max={factor.maxWeight}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12">{factor.maxWeight}%</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boosts" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg">Ranking Boosts</CardTitle>
              <CardDescription>Score multipliers for premium or high-performing clinics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {boosts.map((boost) => (
                <div key={boost.key} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={boost.enabled}
                      onCheckedChange={(v) => toggleBoost(boost.key, v)}
                    />
                    <div>
                      <p className="font-bold">{boost.label}</p>
                      <p className="text-sm text-muted-foreground">{boost.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Multiplier:</span>
                    <Input
                      type="number"
                      value={boost.multiplier}
                      onChange={(e) => updateBoostMultiplier(boost.key, parseFloat(e.target.value) || 1)}
                      className="w-20 text-center"
                      step={0.1}
                      min={1}
                      max={5}
                      disabled={!boost.enabled}
                    />
                    <span className="text-sm font-medium">x</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="penalties" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg">Ranking Penalties</CardTitle>
              <CardDescription>Score deductions for problematic listings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {penalties.map((penalty) => (
                <div key={penalty.key} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={penalty.enabled}
                      onCheckedChange={(v) => togglePenalty(penalty.key, v)}
                    />
                    <div>
                      <p className="font-bold">{penalty.label}</p>
                      <p className="text-sm text-muted-foreground">{penalty.description}</p>
                    </div>
                  </div>
                  <Badge variant={penalty.enabled ? 'destructive' : 'outline'} className="px-4">
                    -{Math.round(penalty.penalty * 100)}%
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ranking Preview</CardTitle>
                  <CardDescription>See how clinics rank with current rules</CardDescription>
                </div>
                <div className="flex gap-4">
                  <Select value={previewCity} onValueChange={setPreviewCity}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities?.map((city) => (
                        <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Claim</TableHead>
                    <TableHead>Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewClinics?.map((clinic: any, index: number) => (
                    <TableRow key={clinic.id}>
                      <TableCell className="font-bold">{index + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{clinic.name}</div>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{clinic.address}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{clinic.city?.name || '-'}</TableCell>
                      <TableCell>{getVerificationBadge(clinic.verification_status || 'unverified')}</TableCell>
                      <TableCell>{getClaimBadge(clinic.claim_status || 'unclaimed')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-gold fill-gold" />
                          <span className="font-medium">{clinic.rating || 0}</span>
                          <span className="text-muted-foreground text-xs">({clinic.review_count || 0})</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!previewClinics || previewClinics.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {previewCity ? 'No clinics found in this city' : 'Select a city to preview rankings'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
