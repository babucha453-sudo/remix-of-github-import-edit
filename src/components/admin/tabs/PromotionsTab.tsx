import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Gift, 
  Building2, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Crown,
  Search,
  MapPin,
  Sparkles,
  Zap,
  TrendingUp,
  Award
} from 'lucide-react';
import { format, addDays, addMonths, isPast } from 'date-fns';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';

interface Clinic {
  id: string;
  name: string;
  slug: string;
  is_active: boolean | null;
  city?: { name: string; state?: { name: string } } | null;
}

// Helper to fetch all clinics using pagination
async function fetchAllClinics(): Promise<Clinic[]> {
  const allClinics: Clinic[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, slug, is_active, city:cities(name, state:states(name))')
      .order('name')
      .range(from, from + batchSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allClinics.push(...(data as unknown as Clinic[]));
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allClinics;
}

export default function PromotionsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clinicSearch, setClinicSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [form, setForm] = useState({
    clinic_id: '',
    plan_id: '',
    duration: '30',
    custom_end_date: '',
    reason: '',
  });

  // Fetch promotions from clinic_subscriptions with promo flag
  const { data: promotions, isLoading } = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_subscriptions')
        .select(`
          *,
          clinic:clinics(id, name, slug),
          plan:subscription_plans(id, name, slug, price_monthly)
        `)
        .not('expires_at', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      return (data || []).filter((s: any) => s.stripe_subscription_id === null || s.stripe_subscription_id === 'promotion');
    },
  });

  // Fetch ALL clinics for selection - NO LIMIT
  const { data: clinics = [], isLoading: clinicsLoading } = useQuery({
    queryKey: ['all-clinics-promo-unlimited'],
    queryFn: fetchAllClinics,
  });

  // Fetch plans
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
  });

  // Filter clinics based on search
  const filteredClinics = useMemo(() => {
    if (!clinicSearch.trim()) return clinics;
    const searchLower = clinicSearch.toLowerCase();
    return clinics.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      c.slug.toLowerCase().includes(searchLower) ||
      c.city?.name?.toLowerCase().includes(searchLower) ||
      c.city?.state?.name?.toLowerCase().includes(searchLower)
    );
  }, [clinics, clinicSearch]);

  // Filter promotions based on search
  const filteredPromotions = useMemo(() => {
    if (!tableSearch.trim()) return promotions;
    const searchLower = tableSearch.toLowerCase();
    return promotions?.filter((p: any) =>
      p.clinic?.name?.toLowerCase().includes(searchLower) ||
      p.plan?.name?.toLowerCase().includes(searchLower)
    );
  }, [promotions, tableSearch]);

  // Get selected clinic name for display
  const selectedClinic = useMemo(() => {
    return clinics.find(c => c.id === form.clinic_id);
  }, [clinics, form.clinic_id]);

  // Get selected plan for display
  const selectedPlan = useMemo(() => {
    return plans?.find(p => p.id === form.plan_id);
  }, [plans, form.plan_id]);

  // Grant promotion mutation
  const grantPromotion = useMutation({
    mutationFn: async (data: typeof form) => {
      const startsAt = new Date();
      let expiresAt: Date;
      
      if (data.duration === 'custom' && data.custom_end_date) {
        expiresAt = new Date(data.custom_end_date);
      } else {
        const days = parseInt(data.duration);
        expiresAt = days >= 30 ? addMonths(startsAt, days / 30) : addDays(startsAt, days);
      }

      const { data: existing } = await supabase
        .from('clinic_subscriptions')
        .select('id, plan_id')
        .eq('clinic_id', data.clinic_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('clinic_subscriptions')
          .update({ 
            plan_id: data.plan_id, 
            status: 'active',
            starts_at: startsAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            stripe_subscription_id: 'promotion',
            updated_at: new Date().toISOString()
          })
          .eq('clinic_id', data.clinic_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clinic_subscriptions')
          .insert({ 
            clinic_id: data.clinic_id, 
            plan_id: data.plan_id,
            status: 'active',
            starts_at: startsAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            stripe_subscription_id: 'promotion'
          });
        if (error) throw error;
      }

      await createAuditLog({
        action: 'GRANT_PROMOTION',
        entityType: 'clinic_subscription',
        entityId: data.clinic_id,
        newValues: { plan_id: data.plan_id, reason: data.reason, expires_at: expiresAt.toISOString() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-subscriptions-admin'] });
      toast.success('Promotion granted successfully');
      setDialogOpen(false);
      setForm({ clinic_id: '', plan_id: '', duration: '30', custom_end_date: '', reason: '' });
      setClinicSearch('');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Revoke promotion mutation
  const revokePromotion = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('clinic_subscriptions')
        .update({ 
          status: 'expired',
          expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);
      if (error) throw error;

      await createAuditLog({
        action: 'REVOKE_PROMOTION',
        entityType: 'clinic_subscription',
        entityId: subscriptionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success('Promotion revoked');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const activePromotions = filteredPromotions?.filter((p: any) => p.status === 'active' && (!p.expires_at || !isPast(new Date(p.expires_at))));
  const expiredPromotions = filteredPromotions?.filter((p: any) => p.status !== 'active' || (p.expires_at && isPast(new Date(p.expires_at))));

  // Plan color mapping
  const getPlanColor = (slug: string) => {
    switch (slug) {
      case 'autopilot-growth': return { bg: 'bg-gradient-to-r from-amber-500 to-orange-500', text: 'text-white', badge: 'bg-amber-100 text-amber-700 border-amber-300' };
      case 'growth-engine': return { bg: 'bg-gradient-to-r from-purple-500 to-indigo-500', text: 'text-white', badge: 'bg-purple-100 text-purple-700 border-purple-300' };
      case 'verified-presence': return { bg: 'bg-gradient-to-r from-blue-500 to-cyan-500', text: 'text-white', badge: 'bg-blue-100 text-blue-700 border-blue-300' };
      default: return { bg: 'bg-gradient-to-r from-slate-400 to-slate-500', text: 'text-white', badge: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Gift className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Promotional Access</h1>
              <p className="text-white/80">Grant free premium plan access to clinics</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-white text-purple-700 hover:bg-white/90 shadow-lg font-semibold">
                <Sparkles className="h-4 w-4" />
                Grant New Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-white" />
                  </div>
                  Grant Free Plan Access
                </DialogTitle>
                <DialogDescription>
                  Select from {clinics.length.toLocaleString()} clinics and grant promotional access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-4">
                {/* Clinic Selection with Search */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-foreground">Select Clinic</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by clinic name, city, or state..."
                      value={clinicSearch}
                      onChange={(e) => setClinicSearch(e.target.value)}
                      className="pl-10 h-11 border-2 focus:border-purple-500"
                    />
                  </div>
                  <ScrollArea className="h-44 border-2 rounded-xl bg-slate-50">
                    <div className="p-2 space-y-1">
                      {clinicsLoading ? (
                        <div className="text-center py-6 text-muted-foreground">Loading clinics...</div>
                      ) : filteredClinics.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          {clinicSearch ? 'No clinics found matching your search' : 'No clinics available'}
                        </div>
                      ) : (
                        filteredClinics.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setForm({ ...form, clinic_id: c.id })}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                              form.clinic_id === c.id 
                                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md' 
                                : 'hover:bg-white hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{c.name}</p>
                                {c.city && (
                                  <p className={`text-xs flex items-center gap-1 ${form.clinic_id === c.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                                    <MapPin className="h-3 w-3" />
                                    {c.city.name}{c.city.state?.name && `, ${c.city.state.name}`}
                                  </p>
                                )}
                              </div>
                              {form.clinic_id === c.id && (
                                <CheckCircle className="h-5 w-5" />
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  {selectedClinic && (
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-3 flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-xs text-purple-600 font-medium">Selected Clinic</p>
                        <p className="font-bold text-purple-800">{selectedClinic.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Plan Selection with Cards */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-foreground">Select Plan</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {plans?.filter(p => p.slug !== 'free').map((p) => {
                      const colors = getPlanColor(p.slug);
                      const isSelected = form.plan_id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setForm({ ...form, plan_id: p.id })}
                          className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected 
                              ? 'border-purple-500 bg-purple-50 shadow-lg ring-2 ring-purple-200' 
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 h-6 w-6 bg-purple-600 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-2">
                            <Crown className={`h-5 w-5 ${p.slug === 'autopilot-growth' ? 'text-amber-500' : p.slug === 'growth-engine' ? 'text-purple-500' : 'text-blue-500'}`} />
                            <span className="font-bold text-foreground">{p.name}</span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-foreground">${p.price_monthly || 0}</span>
                            <span className="text-muted-foreground text-sm">/month</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-foreground">Duration</Label>
                    <Select value={form.duration} onValueChange={(v) => setForm({ ...form, duration: v })}>
                      <SelectTrigger className="h-11 border-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 Days</SelectItem>
                        <SelectItem value="14">14 Days</SelectItem>
                        <SelectItem value="30">1 Month</SelectItem>
                        <SelectItem value="60">2 Months</SelectItem>
                        <SelectItem value="90">3 Months</SelectItem>
                        <SelectItem value="180">6 Months</SelectItem>
                        <SelectItem value="365">1 Year</SelectItem>
                        <SelectItem value="custom">Custom Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.duration === 'custom' ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-foreground">End Date</Label>
                      <Input 
                        type="date" 
                        value={form.custom_end_date}
                        onChange={(e) => setForm({ ...form, custom_end_date: e.target.value })}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        className="h-11 border-2"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-foreground">Reason</Label>
                      <Input
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        placeholder="VIP, Partner, etc."
                        className="h-11 border-2"
                      />
                    </div>
                  )}
                </div>

                {form.duration === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-foreground">Reason (Internal Note)</Label>
                    <Textarea
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder="e.g., Partner clinic, VIP onboarding..."
                      rows={2}
                      className="resize-none border-2"
                    />
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => grantPromotion.mutate(form)}
                  disabled={!form.clinic_id || !form.plan_id || grantPromotion.isPending}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  <Gift className="h-4 w-4" />
                  Grant Promotion
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Grid with Vibrant Colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <CheckCircle className="h-7 w-7" />
              </div>
              <div>
                <p className="text-4xl font-bold">{activePromotions?.length || 0}</p>
                <p className="text-emerald-100 font-medium">Active Promotions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-500 to-slate-600 text-white overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Clock className="h-7 w-7" />
              </div>
              <div>
                <p className="text-4xl font-bold">{expiredPromotions?.length || 0}</p>
                <p className="text-slate-200 font-medium">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Award className="h-7 w-7" />
              </div>
              <div>
                <p className="text-4xl font-bold">{promotions?.length || 0}</p>
                <p className="text-amber-100 font-medium">Total Granted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promotions Table */}
      <Card className="shadow-lg border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-slate-800">All Promotions</CardTitle>
              <CardDescription className="text-slate-600">Manage promotional plan grants with auto-expiry</CardDescription>
            </div>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by clinic or plan..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-10 border-2 border-slate-200 focus:border-purple-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-bold text-slate-700 py-4">Clinic</TableHead>
                <TableHead className="font-bold text-slate-700">Plan</TableHead>
                <TableHead className="font-bold text-slate-700">Started</TableHead>
                <TableHead className="font-bold text-slate-700">Expires</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPromotions?.map((promo: any) => {
                const isExpired = promo.status === 'expired' || (promo.expires_at && isPast(new Date(promo.expires_at)));
                const planColors = getPlanColor(promo.plan?.slug || '');
                
                return (
                  <TableRow key={promo.id} className="hover:bg-slate-50/50">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-purple-600" />
                        </div>
                        <span className="font-semibold text-slate-800">{promo.clinic?.name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${planColors.badge} border font-semibold gap-1`}>
                        <Crown className="h-3 w-3" />
                        {promo.plan?.name || 'Unknown'}
                        {promo.plan?.price_monthly && (
                          <span className="ml-1">(${promo.plan.price_monthly}/mo)</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {promo.starts_at ? format(new Date(promo.starts_at), 'MMM d, yyyy') : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        {promo.expires_at ? format(new Date(promo.expires_at), 'MMM d, yyyy') : 'Never'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isExpired ? (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-300 border font-semibold">
                          Expired
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 border font-semibold">
                          <Zap className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isExpired && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => revokePromotion.mutate(promo.id)}
                          disabled={revokePromotion.isPending}
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!filteredPromotions || filteredPromotions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-4">
                        <Gift className="h-8 w-8 text-purple-500" />
                      </div>
                      <p className="font-bold text-slate-700 text-lg">No promotions found</p>
                      <p className="text-slate-500">Grant a promotion to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
