import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminSubscriptions, useUpdateSubscription, useCreateSubscription } from '@/hooks/useAdminSubscriptions';
import { useAdminClinics } from '@/hooks/useAdminClinics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  CheckCircle, 
  Clock, 
  XCircle,
  Plus,
  TrendingUp,
  DollarSign,
  Calendar,
  Building2,
  AlertTriangle,
  MoreHorizontal,
  RefreshCw,
  Download,
  Crown,
  Zap,
  Shield,
  Star,
  Users,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  PieChart
} from 'lucide-react';
import { format, addMonths, differenceInDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PlanFeature {
  enabled: boolean;
  limit: number | null;
  name: string;
}

interface PlanConfig {
  id: string;
  name: string;
  slug?: string;
  price_usd: number;
  billing_period: string;
  description: string;
  color: string;
  popular?: boolean;
  expected_patients: number;
  features: Record<string, PlanFeature>;
}

// Default plans - same as PlansTab
const DEFAULT_PLANS: PlanConfig[] = [
  {
    id: 'basic',
    name: 'Basic',
    slug: 'basic',
    price_usd: 99,
    billing_period: 'year',
    description: 'Essential features for getting started',
    color: 'slate',
    expected_patients: 2,
    features: {
      claim_profile: { enabled: true, limit: null, name: 'Claim & Customize Profile' },
      profile_listing: { enabled: true, limit: 1, name: 'Profile Listing' },
      appointment_booking: { enabled: true, limit: null, name: 'Appointment Booking' },
      email_support: { enabled: true, limit: null, name: 'Email Support' },
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    slug: 'professional',
    price_usd: 499,
    billing_period: 'year',
    description: 'Advanced tools for growing practices',
    color: 'primary',
    popular: true,
    expected_patients: 6,
    features: {
      claim_profile: { enabled: true, limit: null, name: 'Claim & Customize Profile' },
      verification_badge: { enabled: true, limit: null, name: 'Verification Badge' },
      priority_listing: { enabled: true, limit: null, name: 'Priority Search Ranking' },
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    slug: 'enterprise',
    price_usd: 999,
    billing_period: 'year',
    description: 'Full suite for multi-location practices',
    color: 'gold',
    expected_patients: 11,
    features: {
      claim_profile: { enabled: true, limit: null, name: 'Everything in Professional' },
      dedicated_manager: { enabled: true, limit: null, name: 'Dedicated Account Manager' },
      phone_support: { enabled: true, limit: null, name: '24/7 Phone Support' },
    }
  }
];

export default function SubscriptionsTab() {
  const queryClient = useQueryClient();
  const { data: subscriptions, isLoading } = useAdminSubscriptions();
  const { data: clinicsData } = useAdminClinics();
  const updateSubscription = useUpdateSubscription();
  const createSubscription = useCreateSubscription();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    clinic_id: '',
    plan_name: 'basic',
    price_usd: 99,
    status: 'active' as 'active' | 'pending' | 'expired' | 'cancelled',
    months: 12,
  });

  // Fetch unified plans from global_settings
  const { data: plansData } = useQuery({
    queryKey: ['pricing-plans-unified'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'pricing_plans')
        .maybeSingle();
      if (error) throw error;
      if (data?.value && Array.isArray(data.value)) {
        return data.value as unknown as PlanConfig[];
      }
      return null;
    },
  });

  const plans = plansData || DEFAULT_PLANS;

  // Calculate metrics
  const activeCount = subscriptions?.filter(s => s.status === 'active').length || 0;
  const pendingCount = subscriptions?.filter(s => s.status === 'pending').length || 0;
  const expiredCount = subscriptions?.filter(s => s.status === 'expired').length || 0;
  const cancelledCount = subscriptions?.filter(s => s.status === 'cancelled').length || 0;
  const totalSubs = subscriptions?.length || 0;
  
  // Calculate revenue based on plan prices
  const calculateRevenue = () => {
    if (!subscriptions) return { monthly: 0, yearly: 0 };
    
    let monthly = 0;
    subscriptions.filter(s => s.status === 'active').forEach(sub => {
      const planPrice = sub.plan?.price_monthly || sub.amount_paid || 0;
      monthly += planPrice;
    });
    
    return { monthly, yearly: monthly * 12 };
  };
  
  const { monthly: monthlyRevenue, yearly: yearlyRevenue } = calculateRevenue();
  
  // Expiring soon (within 30 days)
  const expiringSoon = subscriptions?.filter(s => {
    if (s.status !== 'active' || !s.expires_at) return false;
    const daysLeft = differenceInDays(new Date(s.expires_at), new Date());
    return daysLeft > 0 && daysLeft <= 30;
  }) || [];

  // Plan distribution
  const planDistribution = plans.map(plan => {
    const count = subscriptions?.filter(s => 
      s.plan_id === plan.id || s.plan?.slug === plan.slug
    ).length || 0;
    const revenue = count * (plan.price_usd || 0);
    return { ...plan, count, revenue };
  });

  const handleCreate = async () => {
    const selectedPlan = plans.find(p => p.id === form.plan_name);
    
    await createSubscription.mutateAsync({
      clinic_id: form.clinic_id,
      plan_id: selectedPlan?.id || form.plan_name,
      billing_cycle: 'monthly',
    });
    
    setDialogOpen(false);
    setForm({ clinic_id: '', plan_name: 'basic', price_usd: 99, status: 'active', months: 12 });
    toast({ title: 'Subscription created successfully' });
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateSubscription.mutateAsync({ 
      id, 
      updates: { status: status as any } 
    });
    toast({ title: 'Status updated' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-teal/20 text-teal border-0">Active</Badge>;
      case 'pending': return <Badge className="bg-gold/20 text-gold border-0">Pending</Badge>;
      case 'expired': return <Badge variant="secondary">Expired</Badge>;
      case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'enterprise': return <Crown className="h-5 w-5 text-gold" />;
      case 'professional': return <Zap className="h-5 w-5 text-primary" />;
      default: return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const clinics = clinicsData || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Revenue & Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Track revenue, manage subscriptions, and monitor growth</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Subscription
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Subscription</DialogTitle>
                <DialogDescription>Assign a plan to a clinic</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Clinic</Label>
                  <Select value={form.clinic_id} onValueChange={(v) => setForm({ ...form, clinic_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select clinic" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {clinics.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {plans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => setForm({ ...form, plan_name: plan.id, price_usd: plan.price_usd })}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          form.plan_name === plan.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex justify-center mb-1">{getPlanIcon(plan.id)}</div>
                        <p className="text-sm font-medium">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">${plan.price_usd}/yr</p>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select value={String(form.months)} onValueChange={(v) => setForm({ ...form, months: Number(v) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Month</SelectItem>
                        <SelectItem value="3">3 Months</SelectItem>
                        <SelectItem value="6">6 Months</SelectItem>
                        <SelectItem value="12">12 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!form.clinic_id || createSubscription.isPending}>
                  Create Subscription
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Revenue Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Main Revenue Card */}
        <Card className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <CardContent className="p-6 relative">
            <div className="flex items-start justify-between mb-6">
              <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <DollarSign className="h-7 w-7 text-teal" />
              </div>
              <Badge className="bg-teal/20 text-teal border-0 gap-1">
                <TrendingUp className="h-3 w-3" />
                Annual
              </Badge>
            </div>
            <p className="text-slate-400 text-sm mb-1">Annual Recurring Revenue</p>
            <p className="text-4xl font-bold mb-4">${yearlyRevenue.toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-slate-400 text-xs">Monthly Avg</p>
                <p className="text-lg font-semibold">${monthlyRevenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Active Subscriptions</p>
                <p className="text-lg font-semibold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Cards */}
        <Card className="bg-gradient-to-br from-teal/10 to-teal/5 border-teal/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-teal/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-teal" />
              </div>
              <span className="text-xs text-teal font-medium">
                {totalSubs > 0 ? Math.round((activeCount / totalSubs) * 100) : 0}%
              </span>
            </div>
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-gold/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-gold" />
              </div>
              <span className="text-xs text-gold font-medium">
                {totalSubs > 0 ? Math.round((pendingCount / totalSubs) * 100) : 0}%
              </span>
            </div>
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoon.length > 0 && (
        <Card className="border-gold/50 bg-gradient-to-r from-gold/10 to-transparent">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-gold" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gold">{expiringSoon.length} subscription(s) expiring within 30 days</p>
              <p className="text-sm text-muted-foreground">Consider reaching out for renewal to maintain revenue</p>
            </div>
            <Button variant="outline" size="sm" className="border-gold/50 text-gold hover:bg-gold/10">
              View Details
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planDistribution.map((plan) => (
          <Card key={plan.id} className={`overflow-hidden ${
            plan.color === 'gold' ? 'bg-gradient-to-br from-gold/10 to-gold/5 border-gold/30' :
            plan.color === 'primary' ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30' :
            'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50'
          }`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    plan.color === 'gold' ? 'bg-gold/20' :
                    plan.color === 'primary' ? 'bg-primary/20' :
                    'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {getPlanIcon(plan.id)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">${plan.price_usd}/year</p>
                  </div>
                </div>
                {plan.popular && (
                  <Badge className="bg-primary text-primary-foreground text-xs">Popular</Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold">{plan.count}</p>
                  <p className="text-xs text-muted-foreground">Subscribers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">${plan.revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span>Share of total</span>
                  <span>{totalSubs > 0 ? Math.round((plan.count / totalSubs) * 100) : 0}%</span>
                </div>
                <Progress 
                  value={totalSubs > 0 ? (plan.count / totalSubs) * 100 : 0} 
                  className="h-1.5"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 rounded-xl">
          <TabsTrigger value="overview" className="rounded-xl gap-2">
            <Users className="h-4 w-4" />
            All Subscriptions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead className="font-semibold">Clinic</TableHead>
                    <TableHead className="font-semibold">Plan</TableHead>
                    <TableHead className="font-semibold">Price</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Expires</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {subscriptions?.map((sub) => {
                    const daysLeft = sub.expires_at ? differenceInDays(new Date(sub.expires_at), new Date()) : null;
                    return (
                      <TableRow key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{sub.clinic?.name || 'Unknown'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPlanIcon(sub.plan?.slug || 'basic')}
                            <span className="capitalize font-medium">{sub.plan?.name || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">${sub.plan?.price_monthly || sub.amount_paid || 0}/mo</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status || 'pending')}</TableCell>
                        <TableCell>
                          {sub.expires_at ? (
                            <div>
                              <p className="text-sm font-medium">{format(new Date(sub.expires_at), 'MMM d, yyyy')}</p>
                              {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
                                <p className="text-xs text-gold flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {daysLeft} days left
                                </p>
                              )}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-xl">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStatusChange(sub.id, 'active')}>
                                <CheckCircle className="h-4 w-4 mr-2 text-teal" /> Set Active
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(sub.id, 'expired')}>
                                <Clock className="h-4 w-4 mr-2 text-muted-foreground" /> Set Expired
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(sub.id, 'cancelled')}>
                                <XCircle className="h-4 w-4 mr-2 text-coral" /> Cancel
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <RefreshCw className="h-4 w-4 mr-2" /> Renew
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!subscriptions || subscriptions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <CreditCard className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">No subscriptions yet</p>
                            <p className="text-sm text-muted-foreground">Create your first subscription to get started</p>
                          </div>
                          <Button onClick={() => setDialogOpen(true)} className="mt-2 gap-2">
                            <Plus className="h-4 w-4" />
                            Add Subscription
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subscription Status */}
            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Subscription Status</CardTitle>
                </div>
                <CardDescription>Distribution of subscription statuses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Active', count: activeCount, color: 'bg-teal', textColor: 'text-teal' },
                  { label: 'Pending', count: pendingCount, color: 'bg-gold', textColor: 'text-gold' },
                  { label: 'Expired', count: expiredCount, color: 'bg-slate-400', textColor: 'text-slate-400' },
                  { label: 'Cancelled', count: cancelledCount, color: 'bg-coral', textColor: 'text-coral' },
                ].map((item) => {
                  const percent = totalSubs > 0 ? (item.count / totalSubs) * 100 : 0;
                  return (
                    <div key={item.label} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${item.color}`} />
                          {item.label}
                        </span>
                        <span className={item.textColor}>{item.count} ({percent.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Revenue by Plan */}
            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Revenue by Plan</CardTitle>
                </div>
                <CardDescription>Annual revenue contribution by plan type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {planDistribution.map((plan) => {
                  const percent = yearlyRevenue > 0 ? (plan.revenue / yearlyRevenue) * 100 : 0;
                  return (
                    <div key={plan.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex items-center gap-2">
                          {getPlanIcon(plan.id)}
                          {plan.name}
                        </span>
                        <span className="text-muted-foreground">${plan.revenue.toLocaleString()} ({percent.toFixed(0)}%)</span>
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                  );
                })}
                
                <div className="pt-4 border-t mt-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Annual Revenue</span>
                    <span className="font-bold text-lg">${yearlyRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <Card className="rounded-2xl lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Key Metrics</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                    <p className="text-3xl font-bold text-primary">{activeCount}</p>
                    <p className="text-sm text-muted-foreground">Active Subscribers</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                    <p className="text-3xl font-bold text-teal">
                      ${activeCount > 0 ? Math.round(yearlyRevenue / activeCount) : 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg Revenue/Customer</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                    <p className="text-3xl font-bold text-gold">{expiringSoon.length}</p>
                    <p className="text-sm text-muted-foreground">Expiring Soon</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                    <p className="text-3xl font-bold text-coral">{cancelledCount}</p>
                    <p className="text-sm text-muted-foreground">Churned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
