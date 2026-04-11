import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calculator, Shield, Zap, ExternalLink, Edit, Save, Plus, Trash2, 
  Search, DollarSign, MapPin, RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';

export default function ToolsManagementTab() {
  const [activeTab, setActiveTab] = useState('cost-calculator');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Tools Management
          </h2>
          <p className="text-muted-foreground">
            Manage pricing, insurance coverage, and emergency dentist data for public tools
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/tools/dental-cost-calculator" target="_blank">
              <ExternalLink className="h-4 w-4 mr-1" /> Cost Calculator
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/tools/insurance-checker" target="_blank">
              <ExternalLink className="h-4 w-4 mr-1" /> Insurance Checker
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/emergency-dentist" target="_blank">
              <ExternalLink className="h-4 w-4 mr-1" /> Emergency Finder
            </a>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full max-w-xl">
          <TabsTrigger value="cost-calculator" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Cost Calculator
          </TabsTrigger>
          <TabsTrigger value="insurance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Insurance
          </TabsTrigger>
          <TabsTrigger value="emergency" className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Emergency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cost-calculator"><CostCalculatorManager /></TabsContent>
        <TabsContent value="insurance"><InsuranceManager /></TabsContent>
        <TabsContent value="emergency"><EmergencyManager /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Cost Calculator Manager ──
function CostCalculatorManager() {
  const [editingRange, setEditingRange] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterTreatment, setFilterTreatment] = useState('all');

  const { data: treatments } = useQuery({
    queryKey: ['admin-treatments'],
    queryFn: async () => {
      const { data } = await supabase.from('treatments').select('id, name, slug').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: budgetRanges, refetch: refetchRanges } = useQuery({
    queryKey: ['admin-budget-ranges'],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_ranges')
        .select('id, label, price_min, price_max, treatment_id, display_order, is_active, treatments(name)')
        .order('treatment_id')
        .order('price_min');
      return data || [];
    },
  });

  const { data: clinicPricingStats } = useQuery({
    queryKey: ['admin-clinic-pricing-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_treatments')
        .select('treatment_id, price_from, price_to')
        .not('price_from', 'is', null);
      
      const stats: Record<string, { count: number; minPrice: number; maxPrice: number; avgPrice: number }> = {};
      (data || []).forEach((ct: any) => {
        if (!stats[ct.treatment_id]) {
          stats[ct.treatment_id] = { count: 0, minPrice: Infinity, maxPrice: 0, avgPrice: 0 };
        }
        const s = stats[ct.treatment_id];
        s.count++;
        s.minPrice = Math.min(s.minPrice, ct.price_from);
        s.maxPrice = Math.max(s.maxPrice, ct.price_to || ct.price_from);
        s.avgPrice = (s.avgPrice * (s.count - 1) + ct.price_from) / s.count;
      });
      return stats;
    },
  });

  const filtered = filterTreatment === 'all' 
    ? budgetRanges 
    : budgetRanges?.filter((r: any) => r.treatment_id === filterTreatment);

  const saveRange = async (range: any) => {
    const { error } = await supabase.from('budget_ranges').update({
      label: range.label,
      price_min: range.price_min,
      price_max: range.price_max,
      is_active: range.is_active,
    }).eq('id', range.id);

    if (error) { toast.error('Failed to save'); return; }
    toast.success('Budget range updated');
    setEditingRange(null);
    refetchRanges();
  };

  const deleteRange = async (id: string) => {
    const { error } = await supabase.from('budget_ranges').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted');
    refetchRanges();
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Treatments with Pricing</p>
            <p className="text-2xl font-bold">{Object.keys(clinicPricingStats || {}).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Budget Ranges Defined</p>
            <p className="text-2xl font-bold">{budgetRanges?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Clinics with Prices</p>
            <p className="text-2xl font-bold">
              {Object.values(clinicPricingStats || {}).reduce((acc: number, s: any) => acc + s.count, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Ranges Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Budget Ranges</CardTitle>
              <CardDescription>These ranges are shown in the Cost Calculator and search filters</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterTreatment} onValueChange={setFilterTreatment}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Treatments</SelectItem>
                  {treatments?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => refetchRanges()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Treatment</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Min Price</TableHead>
                <TableHead className="text-right">Max Price</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Clinics Using</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((range: any) => (
                <TableRow key={range.id}>
                  <TableCell className="font-medium">{(range as any).treatments?.name || 'N/A'}</TableCell>
                  <TableCell>{range.label}</TableCell>
                  <TableCell className="text-right">${range.price_min}</TableCell>
                  <TableCell className="text-right">${range.price_max}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={range.is_active ? 'default' : 'outline'}>
                      {range.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {clinicPricingStats?.[range.treatment_id]?.count || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingRange({ ...range })}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteRange(range.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No budget ranges found. Add some to power the Cost Calculator.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Clinic Pricing Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Real Clinic Pricing Data</CardTitle>
          <CardDescription>Average prices submitted by dentists on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Treatment</TableHead>
                <TableHead className="text-right">Clinics</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead className="text-right">Max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treatments?.filter((t: any) => clinicPricingStats?.[t.id])
                .map((t: any) => {
                  const s = clinicPricingStats![t.id];
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right">${s.minPrice.toFixed(0)}</TableCell>
                      <TableCell className="text-right">${s.avgPrice.toFixed(0)}</TableCell>
                      <TableCell className="text-right">${s.maxPrice.toFixed(0)}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingRange && (
        <Dialog open onOpenChange={() => setEditingRange(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Budget Range</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Label</Label>
                <Input value={editingRange.label} onChange={e => setEditingRange({ ...editingRange, label: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Price ($)</Label>
                  <Input type="number" value={editingRange.price_min} onChange={e => setEditingRange({ ...editingRange, price_min: +e.target.value })} />
                </div>
                <div>
                  <Label>Max Price ($)</Label>
                  <Input type="number" value={editingRange.price_max} onChange={e => setEditingRange({ ...editingRange, price_max: +e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRange(null)}>Cancel</Button>
              <Button onClick={() => saveRange(editingRange)}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Insurance Manager ──
function InsuranceManager() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');

  const { data: insurances, refetch } = useQuery({
    queryKey: ['admin-insurances'],
    queryFn: async () => {
      const { data } = await supabase.from('insurances').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: clinicInsuranceCounts } = useQuery({
    queryKey: ['admin-clinic-insurance-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('clinic_insurances').select('insurance_id');
      const counts: Record<string, number> = {};
      (data || []).forEach((ci: any) => {
        counts[ci.insurance_id] = (counts[ci.insurance_id] || 0) + 1;
      });
      return counts;
    },
  });

  const saveInsurance = async () => {
    if (!editingId || !editName.trim()) return;
    const { error } = await supabase.from('insurances').update({ name: editName.trim() }).eq('id', editingId);
    if (error) { toast.error('Failed'); return; }
    toast.success('Updated');
    setEditingId(null);
    refetch();
  };

  const addInsurance = async () => {
    if (!newName.trim()) return;
    const slug = newName.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase.from('insurances').insert({ name: newName.trim(), slug });
    if (error) { toast.error('Failed to add'); return; }
    toast.success('Insurance added');
    setNewName('');
    refetch();
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Insurance Providers</CardTitle>
          <CardDescription>Manage insurance providers shown in the Insurance Checker and clinic profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Add new insurance provider..." value={newName} onChange={e => setNewName(e.target.value)} />
            <Button onClick={addInsurance} disabled={!newName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider Name</TableHead>
                <TableHead className="text-center">Clinics Accepting</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurances?.map((ins: any) => (
                <TableRow key={ins.id}>
                  <TableCell>
                    {editingId === ins.id ? (
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="w-64" />
                    ) : (
                      <span className="font-medium">{ins.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{clinicInsuranceCounts?.[ins.id] || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === ins.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" onClick={saveInsurance}><Save className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(ins.id); setEditName(ins.name); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Emergency Dentist Manager ──
function EmergencyManager() {
  const { data: emergencyStats } = useQuery({
    queryKey: ['admin-emergency-stats'],
    queryFn: async () => {
      const { count: totalClinics } = await supabase
        .from('clinics')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('phone', 'is', null);

      const { count: withHours } = await supabase
        .from('clinic_hours')
        .select('clinic_id', { count: 'exact', head: true });

      const { data: extendedHours } = await supabase
        .from('clinic_hours')
        .select('clinic_id')
        .gte('close_time', '20:00:00')
        .eq('is_closed', false);

      const uniqueExtended = new Set((extendedHours || []).map((h: any) => h.clinic_id));

      return {
        totalClinics: totalClinics || 0,
        withHours: withHours || 0,
        extendedHours: uniqueExtended.size,
      };
    },
  });

  const { data: cityCoverage } = useQuery({
    queryKey: ['admin-city-clinic-coverage'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('city_id, cities(name, states(abbreviation))')
        .eq('is_active', true)
        .not('phone', 'is', null);
      
      const cityMap: Record<string, { name: string; state: string; count: number }> = {};
      (data || []).forEach((c: any) => {
        const cityName = c.cities?.name || 'Unknown';
        const state = c.cities?.states?.abbreviation || '';
        const key = `${cityName}-${state}`;
        if (!cityMap[key]) cityMap[key] = { name: cityName, state, count: 0 };
        cityMap[key].count++;
      });

      return Object.values(cityMap).sort((a, b) => b.count - a.count).slice(0, 30);
    },
  });

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Clinics with Phone</p>
            <p className="text-2xl font-bold">{emergencyStats?.totalClinics || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Clinics with Hours Set</p>
            <p className="text-2xl font-bold">{emergencyStats?.withHours || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Extended Hours (8PM+)</p>
            <p className="text-2xl font-bold text-primary">{emergencyStats?.extendedHours || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>City Coverage</CardTitle>
          <CardDescription>Top cities by number of clinics available for emergency search</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Clinics</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cityCoverage?.map((city: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{city.name}</TableCell>
                  <TableCell>{city.state}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{city.count}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
