import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Crown,
  Package,
  Building2,
  CheckCircle,
  XCircle,
  Edit,
  Plus,
  DollarSign,
  Star,
  Zap,
  Shield,
  MessageSquare,
  BarChart3,
  Globe,
  Users,
  Bell,
  Calendar,
  FileText,
  Settings,
  Save,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Phone,
  Mail,
  Link,
  BadgeCheck,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';
import DarkCard from '@/components/dashboard/DarkCard';

// Default plan configurations
const DEFAULT_PLANS = [
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
      booking_url: { enabled: true, limit: null, name: 'Shareable Booking URL' },
      basic_analytics: { enabled: true, limit: null, name: 'Basic Analytics' },
      review_collection: { enabled: true, limit: 10, name: 'Review Collection' },
      email_support: { enabled: true, limit: null, name: 'Email Support' },
      verification_badge: { enabled: false, limit: null, name: 'Verification Badge' },
      priority_listing: { enabled: false, limit: null, name: 'Priority Search Ranking' },
      sms_reminders: { enabled: false, limit: null, name: 'SMS Reminders' },
      reputation_management: { enabled: false, limit: null, name: 'Reputation Management' },
      gmb_sync: { enabled: false, limit: null, name: 'Google My Business Sync' },
      custom_branding: { enabled: false, limit: null, name: 'Custom Branding' },
      api_access: { enabled: false, limit: null, name: 'API Access' },
      dedicated_manager: { enabled: false, limit: null, name: 'Dedicated Account Manager' },
      phone_support: { enabled: false, limit: null, name: 'Phone Support' },
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
      profile_listing: { enabled: true, limit: 3, name: 'Profile Listing' },
      appointment_booking: { enabled: true, limit: null, name: 'Appointment Booking' },
      booking_url: { enabled: true, limit: null, name: 'Shareable Booking URL' },
      basic_analytics: { enabled: true, limit: null, name: 'Advanced Analytics' },
      review_collection: { enabled: true, limit: 100, name: 'Review Collection' },
      email_support: { enabled: true, limit: null, name: 'Priority Email Support' },
      verification_badge: { enabled: true, limit: null, name: 'Verification Badge' },
      priority_listing: { enabled: true, limit: null, name: 'Priority Search Ranking' },
      sms_reminders: { enabled: true, limit: 200, name: 'SMS Reminders' },
      reputation_management: { enabled: true, limit: null, name: 'Reputation Management' },
      gmb_sync: { enabled: true, limit: null, name: 'Google My Business Sync' },
      custom_branding: { enabled: false, limit: null, name: 'Custom Branding' },
      api_access: { enabled: false, limit: null, name: 'API Access' },
      dedicated_manager: { enabled: false, limit: null, name: 'Dedicated Account Manager' },
      phone_support: { enabled: false, limit: null, name: 'Phone Support' },
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
      claim_profile: { enabled: true, limit: null, name: 'Claim & Customize Profile' },
      profile_listing: { enabled: true, limit: null, name: 'Unlimited Profile Listings' },
      appointment_booking: { enabled: true, limit: null, name: 'Unlimited Appointment Booking' },
      booking_url: { enabled: true, limit: null, name: 'Shareable Booking URL' },
      basic_analytics: { enabled: true, limit: null, name: 'Enterprise Analytics' },
      review_collection: { enabled: true, limit: null, name: 'Unlimited Review Collection' },
      email_support: { enabled: true, limit: null, name: 'Priority Email Support' },
      verification_badge: { enabled: true, limit: null, name: 'Premium Verification Badge' },
      priority_listing: { enabled: true, limit: null, name: 'Top Priority Search Ranking' },
      sms_reminders: { enabled: true, limit: null, name: 'Unlimited SMS Reminders' },
      reputation_management: { enabled: true, limit: null, name: 'Full Reputation Suite' },
      gmb_sync: { enabled: true, limit: null, name: 'Google My Business Sync' },
      custom_branding: { enabled: true, limit: null, name: 'Custom Branding' },
      api_access: { enabled: true, limit: null, name: 'Full API Access' },
      dedicated_manager: { enabled: true, limit: null, name: 'Dedicated Account Manager' },
      phone_support: { enabled: true, limit: null, name: '24/7 Phone Support' },
    }
  }
];

// Feature icons mapping
const FEATURE_ICONS: Record<string, React.ElementType> = {
  claim_profile: BadgeCheck,
  profile_listing: Building2,
  appointment_booking: Calendar,
  booking_url: Link,
  basic_analytics: BarChart3,
  review_collection: Star,
  email_support: Mail,
  verification_badge: Shield,
  priority_listing: Search,
  sms_reminders: Bell,
  reputation_management: TrendingUp,
  gmb_sync: Globe,
  custom_branding: Sparkles,
  api_access: Settings,
  dedicated_manager: Users,
  phone_support: Phone,
};

interface PlanFeature {
  enabled: boolean;
  limit: number | null;
  name: string;
}

interface PlanConfig {
  id: string;
  name: string;
  slug: string;
  price_usd: number;
  billing_period: string;
  description: string;
  color: string;
  popular?: boolean;
  expected_patients: number;
  features: Record<string, PlanFeature>;
}

export default function PlansTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('plans');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [customPlanDialogOpen, setCustomPlanDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS);
  const [hasChanges, setHasChanges] = useState(false);

  // Custom plan request state
  const [customRequest, setCustomRequest] = useState({
    clinicName: '',
    contactEmail: '',
    contactPhone: '',
    expectedAppointments: '',
    reviewRequestsNeeded: '',
    additionalRequirements: '',
  });

  // Fetch saved plans from global_settings
  const { data: savedPlansData, isLoading: plansLoading } = useQuery({
    queryKey: ['admin-plans-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'pricing_plans')
        .maybeSingle();
      if (error) throw error;
      // Safely cast the value to PlanConfig[] or null
      if (data?.value && Array.isArray(data.value)) {
        return data.value as unknown as PlanConfig[];
      }
      return null;
    },
  });

  // Fetch clinics with subscriptions
  const { data: clinicSubscriptions = [] } = useQuery({
    queryKey: ['clinic-subscriptions-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_subscriptions')
        .select(`
          *,
          clinic:clinics(id, name, slug, verification_status),
          plan:subscription_plans(id, name, slug)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all clinics for assignment - NO LIMIT
  const [clinicSearch, setClinicSearch] = useState('');
  const { data: clinics = [], isLoading: clinicsLoading } = useQuery({
    queryKey: ['all-clinics-for-plans-unlimited'],
    queryFn: async () => {
      const allClinics: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('clinics')
          .select('id, name, slug, city:cities(name, state:states(name))')
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

      return allClinics;
    },
  });

  // Filter clinics based on search
  const filteredClinicsForAssign = useMemo(() => {
    if (!clinicSearch.trim()) return clinics;
    const searchLower = clinicSearch.toLowerCase();
    return clinics.filter((c: any) => 
      c.name?.toLowerCase().includes(searchLower) ||
      c.slug?.toLowerCase().includes(searchLower) ||
      c.city?.name?.toLowerCase().includes(searchLower) ||
      c.city?.state?.name?.toLowerCase().includes(searchLower)
    );
  }, [clinics, clinicSearch]);

  // Load saved plans or defaults
  useEffect(() => {
    if (savedPlansData && Array.isArray(savedPlansData)) {
      setPlans(savedPlansData as PlanConfig[]);
    }
  }, [savedPlansData]);

  // Save plans configuration
  const savePlans = useMutation({
    mutationFn: async (updatedPlans: PlanConfig[]) => {
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', 'pricing_plans')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('global_settings')
          .update({ value: updatedPlans as unknown as any, updated_at: new Date().toISOString() })
          .eq('key', 'pricing_plans');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .insert({ 
            key: 'pricing_plans', 
            value: updatedPlans as any,
            description: 'Platform subscription pricing plans configuration'
          });
        if (error) throw error;
      }

      await createAuditLog({
        action: 'UPDATE_PRICING_PLANS',
        entityType: 'global_settings',
        entityId: 'pricing_plans',
        newValues: { plans: updatedPlans.map(p => ({ name: p.name, price: p.price_usd })) }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans-config'] });
      toast.success('Plans saved successfully');
      setHasChanges(false);
    },
    onError: (e) => toast.error('Failed to save: ' + e.message),
  });

  // Assign plan to clinic
  const assignPlan = useMutation({
    mutationFn: async ({ clinicId, planId }: { clinicId: string; planId: string }) => {
      const { data: existing } = await supabase
        .from('clinic_subscriptions')
        .select('id')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('clinic_subscriptions')
          .update({ plan_id: planId, status: 'active', updated_at: new Date().toISOString() })
          .eq('clinic_id', clinicId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clinic_subscriptions')
          .insert({ clinic_id: clinicId, plan_id: planId, status: 'active' });
        if (error) throw error;
      }
      
      await createAuditLog({
        action: 'ASSIGN_PLAN',
        entityType: 'clinic_subscription',
        entityId: clinicId,
        newValues: { planId }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-subscriptions-admin'] });
      toast.success('Plan assigned successfully');
      setAssignDialogOpen(false);
      setSelectedClinic('');
      setSelectedPlan('');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Submit custom plan request
  const submitCustomRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('leads')
        .insert({
          patient_name: customRequest.clinicName,
          patient_email: customRequest.contactEmail,
          patient_phone: customRequest.contactPhone,
          message: `Custom Plan Request:
- Expected Appointments/Year: ${customRequest.expectedAppointments}
- Review Requests Needed: ${customRequest.reviewRequestsNeeded}
- Additional Requirements: ${customRequest.additionalRequirements}`,
          source: 'custom_plan_request',
          status: 'new',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Custom plan request submitted! Our team will contact you.');
      setCustomPlanDialogOpen(false);
      setCustomRequest({
        clinicName: '',
        contactEmail: '',
        contactPhone: '',
        expectedAppointments: '',
        reviewRequestsNeeded: '',
        additionalRequirements: '',
      });
    },
    onError: (e) => toast.error('Failed to submit: ' + e.message),
  });

  // Update plan feature
  const updatePlanFeature = (planId: string, featureKey: string, updates: Partial<PlanFeature>) => {
    setPlans(prev => prev.map(plan => {
      if (plan.id === planId) {
        return {
          ...plan,
          features: {
            ...plan.features,
            [featureKey]: {
              ...plan.features[featureKey],
              ...updates
            }
          }
        };
      }
      return plan;
    }));
    setHasChanges(true);
  };

  // Update plan details
  const updatePlanDetails = (planId: string, updates: Partial<PlanConfig>) => {
    setPlans(prev => prev.map(plan => 
      plan.id === planId ? { ...plan, ...updates } : plan
    ));
    setHasChanges(true);
  };

  // Open edit dialog for plan
  const openEditPlan = (plan: PlanConfig) => {
    setEditingPlan({ ...plan });
    setEditPlanDialogOpen(true);
  };

  // Save edited plan
  const saveEditedPlan = () => {
    if (editingPlan) {
      updatePlanDetails(editingPlan.id, editingPlan);
      setEditPlanDialogOpen(false);
      setEditingPlan(null);
    }
  };

  const getPlanBorderColor = (color: string) => {
    switch (color) {
      case 'primary': return 'ring-primary/50';
      case 'gold': return 'ring-gold/50';
      default: return 'ring-slate-600/50';
    }
  };

  if (plansLoading) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Crown className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Plans & Features</h1>
              <p className="text-white/80">Manage subscription plans and control feature access</p>
            </div>
          </div>
          <div className="flex gap-3">
            {hasChanges && (
              <Button 
                onClick={() => savePlans.mutate(plans)}
                disabled={savePlans.isPending}
                className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
              >
                <Save className="h-4 w-4" />
                Save All Changes
              </Button>
            )}
            <Dialog open={assignDialogOpen} onOpenChange={(open) => {
              setAssignDialogOpen(open);
              if (!open) setClinicSearch('');
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-white text-indigo-700 hover:bg-white/90 shadow-lg font-semibold">
                  <Plus className="h-4 w-4" />
                  Assign Plan to Clinic
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white max-w-xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-xl">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-white" />
                    </div>
                    Assign Plan to Clinic
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Search from {clinics.length.toLocaleString()} clinics and assign a subscription plan
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  {/* Clinic Search & Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-foreground">Select Clinic</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, city, or state..."
                        value={clinicSearch}
                        onChange={(e) => setClinicSearch(e.target.value)}
                        className="pl-10 h-11 border-2 focus:border-indigo-500"
                      />
                    </div>
                    <ScrollArea className="h-44 border-2 rounded-xl bg-slate-50">
                      <div className="p-2 space-y-1">
                        {clinicsLoading ? (
                          <div className="text-center py-6 text-muted-foreground">Loading clinics...</div>
                        ) : filteredClinicsForAssign.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            {clinicSearch ? 'No clinics found' : 'No clinics available'}
                          </div>
                        ) : (
                          filteredClinicsForAssign.slice(0, 100).map((clinic: any) => (
                            <button
                              key={clinic.id}
                              type="button"
                              onClick={() => setSelectedClinic(clinic.id)}
                              className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                                selectedClinic === clinic.id 
                                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md' 
                                  : 'hover:bg-white hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold">{clinic.name}</p>
                                  {clinic.city && (
                                    <p className={`text-xs ${selectedClinic === clinic.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                                      {clinic.city.name}{clinic.city.state?.name && `, ${clinic.city.state.name}`}
                                    </p>
                                  )}
                                </div>
                                {selectedClinic === clinic.id && (
                                  <CheckCircle className="h-5 w-5" />
                                )}
                              </div>
                            </button>
                          ))
                        )}
                        {filteredClinicsForAssign.length > 100 && (
                          <p className="text-center text-xs text-muted-foreground py-2 bg-white rounded-lg">
                            Showing first 100 results. Refine search to see more.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                    {selectedClinic && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-indigo-200 rounded-xl p-3 flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                        <div>
                          <p className="text-xs text-indigo-600 font-medium">Selected Clinic</p>
                          <p className="font-bold text-indigo-800">{clinics.find((c: any) => c.id === selectedClinic)?.name}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Plan Selection with Cards */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-foreground">Select Plan</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {plans.map((plan) => {
                        const isSelected = selectedPlan === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                              isSelected 
                                ? 'border-indigo-500 bg-indigo-50 shadow-lg ring-2 ring-indigo-200' 
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute -top-2 -right-2 h-6 w-6 bg-indigo-600 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-4 w-4 text-white" />
                              </div>
                            )}
                            <div className="flex items-center gap-2 mb-2">
                              <Crown className={`h-5 w-5 ${plan.color === 'gold' ? 'text-amber-500' : plan.color === 'primary' ? 'text-indigo-500' : 'text-slate-500'}`} />
                              <span className="font-bold text-foreground">{plan.name}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-foreground">${plan.price_usd}</span>
                              <span className="text-muted-foreground text-sm">/{plan.billing_period}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => assignPlan.mutate({ clinicId: selectedClinic, planId: selectedPlan })}
                    disabled={!selectedClinic || !selectedPlan || assignPlan.isPending}
                    className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Assign Plan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Value Proposition Banner */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <DollarSign className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Unbeatable Value vs Competitors</h3>
              <p className="text-emerald-100 mb-4">
                While other platforms charge <span className="text-red-300 font-bold">$120-$190 per new patient booking</span>, 
                our platform offers new patient acquisition at just <span className="text-white font-bold">$99 per booking equivalent</span> — 
                saving practices thousands annually.
              </p>
              <div className="flex gap-6 flex-wrap">
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                  <Badge className="bg-red-500/80 text-white border-0">Competitors</Badge>
                  <span className="font-bold">$120-190/booking</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2">
                  <Badge className="bg-white text-emerald-700 border-0 font-bold">Our Platform</Badge>
                  <span className="font-bold">~$99/booking</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Alert className="border-2 border-amber-300 bg-amber-50">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <AlertDescription className="text-amber-800 ml-2">
          <strong className="text-amber-900">Expected Patient Numbers Disclaimer:</strong> Patient acquisition estimates are based on average platform performance 
          and are <strong>not guaranteed</strong>. Actual results depend on profile completeness, reviews, competitive landscape, 
          and responsiveness to leads. We recommend optimizing your profile for best results.
        </AlertDescription>
      </Alert>

      {/* Plan Cards - Editable */}
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative card-modern overflow-hidden ${plan.popular ? 'ring-2 ring-primary/50 shadow-lg' : ''}`}
          >
            {/* Top accent bar */}
            <div className={`h-1.5 w-full ${
              plan.color === 'primary' ? 'bg-gradient-to-r from-primary to-teal' : 
              plan.color === 'gold' ? 'bg-gradient-to-r from-gold to-amber-400' : 
              'bg-gradient-to-r from-muted-foreground to-muted'
            }`} />
            
            <CardContent className="p-6">
              {plan.popular && (
                <div className="absolute -top-0 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 rounded-t-none">Most Popular</Badge>
                </div>
              )}
              
              {/* Edit Button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => openEditPlan(plan)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              
              {/* Plan Header */}
              <div className="flex items-center gap-3 mb-4 mt-2">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                  plan.color === 'primary' ? 'bg-primary/10' : 
                  plan.color === 'gold' ? 'bg-gold/10' : 'bg-muted'
                }`}>
                  <Crown className={`h-6 w-6 ${
                    plan.color === 'primary' ? 'text-primary' : 
                    plan.color === 'gold' ? 'text-gold' : 'text-muted-foreground'
                  }`} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
              </div>

              {/* Price - Editable */}
              <div className="text-center py-4 border-y border-border my-4">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <span className="text-4xl font-black text-foreground">{plan.price_usd}</span>
                  <span className="text-muted-foreground">/{plan.billing_period}</span>
                </div>
                <div className="mt-2 flex items-center justify-center gap-1 text-sm">
                  <TrendingUp className="h-4 w-4 text-teal" />
                  <span className="text-muted-foreground">Expected:</span>
                  <span className="text-teal font-semibold">{plan.expected_patients} new patients/year</span>
                </div>
              </div>

              {/* Features with Toggles */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                {Object.entries(plan.features).map(([key, feature]) => {
                  const Icon = FEATURE_ICONS[key] || CheckCircle;
                  
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {feature.enabled ? (
                          <CheckCircle className="h-4 w-4 text-teal shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        )}
                        <Icon className={`h-4 w-4 shrink-0 ${feature.enabled ? 'text-foreground' : 'text-muted-foreground/50'}`} />
                        <span className={`text-sm truncate ${feature.enabled ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                          {feature.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {feature.enabled && feature.limit !== null && (
                          <Input
                            type="number"
                            value={feature.limit}
                            onChange={(e) => updatePlanFeature(plan.id, key, { limit: parseInt(e.target.value) || 0 })}
                            className="w-16 h-6 text-xs text-center"
                          />
                        )}
                        {feature.enabled && feature.limit === null && (
                          <span className="text-xs text-teal bg-teal/10 px-2 py-0.5 rounded">
                            ∞
                          </span>
                        )}
                        <Switch
                          checked={feature.enabled}
                          onCheckedChange={(checked) => updatePlanFeature(plan.id, key, { enabled: checked })}
                          className="data-[state=checked]:bg-teal"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Custom Plan Card */}
        <Card className="border-dashed border-2 border-border card-modern">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/10 to-gold/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Custom Plan</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Need specific features or volume? Build a plan tailored to your practice's unique needs.
            </p>
            <Dialog open={customPlanDialogOpen} onOpenChange={setCustomPlanDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  <Plus className="h-4 w-4 mr-2" />
                  Request Custom Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white max-w-md">
                <DialogHeader>
                  <DialogTitle>Request Custom Plan</DialogTitle>
                  <DialogDescription>
                    Tell us about your practice needs and our team will create a tailored solution
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Practice/Clinic Name</Label>
                    <Input
                      value={customRequest.clinicName}
                      onChange={(e) => setCustomRequest(prev => ({ ...prev, clinicName: e.target.value }))}
                      placeholder="e.g., Smile Dental Center"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        value={customRequest.contactEmail}
                        onChange={(e) => setCustomRequest(prev => ({ ...prev, contactEmail: e.target.value }))}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <Input
                        type="tel"
                        value={customRequest.contactPhone}
                        onChange={(e) => setCustomRequest(prev => ({ ...prev, contactPhone: e.target.value }))}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Expected Appointments/Year</Label>
                      <Input
                        type="number"
                        value={customRequest.expectedAppointments}
                        onChange={(e) => setCustomRequest(prev => ({ ...prev, expectedAppointments: e.target.value }))}
                        placeholder="e.g., 500"
                      />
                    </div>
                    <div>
                      <Label>Review Requests Needed</Label>
                      <Input
                        type="number"
                        value={customRequest.reviewRequestsNeeded}
                        onChange={(e) => setCustomRequest(prev => ({ ...prev, reviewRequestsNeeded: e.target.value }))}
                        placeholder="e.g., 200"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Additional Requirements</Label>
                    <Textarea
                      value={customRequest.additionalRequirements}
                      onChange={(e) => setCustomRequest(prev => ({ ...prev, additionalRequirements: e.target.value }))}
                      placeholder="Describe any specific features, integrations, or needs..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCustomPlanDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => submitCustomRequest.mutate()}
                    disabled={!customRequest.clinicName || !customRequest.contactEmail || submitCustomRequest.isPending}
                  >
                    Submit Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Edit Plan Dialog */}
      <Dialog open={editPlanDialogOpen} onOpenChange={setEditPlanDialogOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editingPlan?.name} Plan</DialogTitle>
            <DialogDescription>Customize plan details and pricing</DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Plan Name</Label>
                  <Input
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label>Price (USD)</Label>
                  <Input
                    type="number"
                    value={editingPlan.price_usd}
                    onChange={(e) => setEditingPlan(prev => prev ? { ...prev, price_usd: parseInt(e.target.value) || 0 } : null)}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expected Patients/Year</Label>
                  <Input
                    type="number"
                    value={editingPlan.expected_patients}
                    onChange={(e) => setEditingPlan(prev => prev ? { ...prev, expected_patients: parseInt(e.target.value) || 0 } : null)}
                  />
                </div>
                <div>
                  <Label>Color Theme</Label>
                  <Select
                    value={editingPlan.color}
                    onValueChange={(value) => setEditingPlan(prev => prev ? { ...prev, color: value } : null)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="slate">Slate (Default)</SelectItem>
                      <SelectItem value="primary">Primary (Blue)</SelectItem>
                      <SelectItem value="gold">Gold (Premium)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingPlan.popular || false}
                  onCheckedChange={(checked) => setEditingPlan(prev => prev ? { ...prev, popular: checked } : null)}
                />
                <Label>Mark as "Most Popular"</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditedPlan}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs for Assignments and Feature Registry */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 h-14 rounded-xl bg-slate-100 p-1">
          <TabsTrigger 
            value="assignments" 
            className="rounded-lg h-12 font-semibold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-md"
          >
            <Building2 className="h-5 w-5 mr-2" />
            Clinic Assignments
          </TabsTrigger>
          <TabsTrigger 
            value="features" 
            className="rounded-lg h-12 font-semibold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-md"
          >
            <Package className="h-5 w-5 mr-2" />
            Feature Comparison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4">
          <Card className="overflow-hidden border shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-xl text-foreground">Clinic Plan Assignments</CardTitle>
              <CardDescription className="text-muted-foreground">View and manage which clinics have which plans</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-bold text-foreground">Clinic</TableHead>
                    <TableHead className="font-bold text-foreground">Plan</TableHead>
                    <TableHead className="font-bold text-foreground">Status</TableHead>
                    <TableHead className="font-bold text-foreground">Expires</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinicSubscriptions.map((sub: any) => (
                    <TableRow key={sub.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-foreground">{sub.clinic?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 font-medium">
                          <Crown className="h-3 w-3 text-amber-500" />
                          {sub.plan?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`capitalize ${
                            sub.status === 'active' 
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clinicSubscriptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="font-medium">No plan assignments yet</p>
                        <p className="text-sm">Assign plans to clinics to get started</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <Card className="overflow-hidden border shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-xl text-foreground">Feature Comparison</CardTitle>
              <CardDescription className="text-muted-foreground">Compare features across all subscription tiers</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b-2">
                      <TableHead className="w-72 font-bold text-foreground py-4">Feature</TableHead>
                      {plans.map(plan => (
                        <TableHead key={plan.id} className="text-center py-4">
                          <div className="flex flex-col items-center gap-1">
                            <Crown className={`h-5 w-5 ${plan.color === 'gold' ? 'text-amber-500' : plan.color === 'primary' ? 'text-primary' : 'text-slate-500'}`} />
                            <span className="font-bold text-foreground text-base">{plan.name}</span>
                            <span className="text-sm text-muted-foreground font-medium">${plan.price_usd}/year</span>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center py-4">
                        <div className="flex flex-col items-center gap-1">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <span className="font-bold text-foreground text-base">Custom</span>
                          <span className="text-sm text-muted-foreground font-medium">Contact us</span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Expected Patients Row - Highlighted */}
                    <TableRow className="bg-emerald-50/50 border-b-2 border-emerald-100">
                      <TableCell className="font-semibold py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                          </div>
                          <span className="text-foreground">Expected New Patients/Year</span>
                        </div>
                      </TableCell>
                      {plans.map(plan => (
                        <TableCell key={plan.id} className="text-center py-4">
                          <span className="font-bold text-lg text-emerald-600">{plan.expected_patients}</span>
                        </TableCell>
                      ))}
                      <TableCell className="text-center py-4">
                        <span className="font-semibold text-primary">Unlimited</span>
                      </TableCell>
                    </TableRow>

                    {/* Feature Rows */}
                    {Object.keys(plans[0]?.features || {}).map((featureKey, idx) => {
                      const Icon = FEATURE_ICONS[featureKey] || CheckCircle;
                      const featureName = plans[0]?.features[featureKey]?.name || featureKey;
                      
                      return (
                        <TableRow key={featureKey} className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <span className="font-medium text-foreground">{featureName}</span>
                            </div>
                          </TableCell>
                          {plans.map(plan => {
                            const feature = plan.features[featureKey];
                            return (
                              <TableCell key={plan.id} className="text-center py-3">
                                {feature?.enabled ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                                    {feature.limit !== null && (
                                      <span className="text-sm font-medium text-foreground">{feature.limit}</span>
                                    )}
                                    {feature.limit === null && (
                                      <span className="text-sm font-semibold text-emerald-600">∞</span>
                                    )}
                                  </div>
                                ) : (
                                  <XCircle className="h-5 w-5 text-slate-300 mx-auto" />
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center py-3">
                            <Badge variant="outline" className="text-xs border-primary/30 text-primary font-medium">
                              Configurable
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
