import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Stethoscope,
  Plus,
  Trash2,
  Save,
  Loader2,
  DollarSign,
  Search,
  Check,
  Sparkles,
} from 'lucide-react';
import { createAuditLog } from '@/lib/audit';
import { NoPracticeLinked } from './NoPracticeLinked';
import { cn } from '@/lib/utils';

interface Treatment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

interface ClinicTreatment {
  id: string;
  clinic_id: string;
  treatment_id: string;
  price_from: number | null;
  price_to: number | null;
  treatment: Treatment;
}

export default function ServicesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddingService, setIsAddingService] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null);
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPriceFrom, setEditPriceFrom] = useState('');
  const [editPriceTo, setEditPriceTo] = useState('');

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-services', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all treatments
  const { data: allTreatments } = useQuery({
    queryKey: ['all-treatments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatments')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
        .order('name');

      if (error) throw error;
      return data as Treatment[];
    },
  });

  // Fetch clinic's treatments
  const { data: clinicTreatments, isLoading: treatmentsLoading } = useQuery({
    queryKey: ['clinic-treatments', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_treatments')
        .select(`
          id, clinic_id, treatment_id, price_from, price_to,
          treatment:treatments(id, name, slug, description, icon)
        `)
        .eq('clinic_id', clinic?.id);

      if (error) throw error;
      return (data || []).map((ct: any) => ({
        ...ct,
        treatment: ct.treatment,
      })) as ClinicTreatment[];
    },
    enabled: !!clinic?.id,
  });

  // Add treatment mutation
  const addTreatment = useMutation({
    mutationFn: async () => {
      if (!clinic?.id || !selectedTreatment) throw new Error('Missing data');

      const { error } = await supabase
        .from('clinic_treatments')
        .insert({
          clinic_id: clinic.id,
          treatment_id: selectedTreatment,
          price_from: priceFrom ? parseFloat(priceFrom) : null,
          price_to: priceTo ? parseFloat(priceTo) : null,
        });

      if (error) throw error;

      await createAuditLog({
        action: 'CREATE',
        entityType: 'clinic_treatment',
        entityId: clinic.id,
        newValues: { treatment_id: selectedTreatment, price_from: priceFrom, price_to: priceTo },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-treatments'] });
      toast.success('Treatment added');
      setIsAddingService(false);
      setSelectedTreatment(null);
      setPriceFrom('');
      setPriceTo('');
      setSearchTerm('');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add treatment'),
  });

  // Remove treatment mutation
  const removeTreatment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clinic_treatments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await createAuditLog({
        action: 'DELETE',
        entityType: 'clinic_treatment',
        entityId: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-treatments'] });
      toast.success('Treatment removed');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to remove treatment'),
  });

  // Update pricing mutation
  const updatePricing = useMutation({
    mutationFn: async ({ id, priceFrom, priceTo }: { id: string; priceFrom: number | null; priceTo: number | null }) => {
      const { error } = await supabase
        .from('clinic_treatments')
        .update({ price_from: priceFrom, price_to: priceTo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-treatments'] });
      toast.success('Pricing updated');
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update pricing'),
  });

  const availableTreatments = allTreatments?.filter(
    (t) => !clinicTreatments?.some((ct) => ct.treatment_id === t.id)
  );

  const filteredAvailable = availableTreatments?.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEditing = (ct: ClinicTreatment) => {
    setEditingId(ct.id);
    setEditPriceFrom(ct.price_from?.toString() || '');
    setEditPriceTo(ct.price_to?.toString() || '');
  };

  const saveEdit = (id: string) => {
    updatePricing.mutate({
      id,
      priceFrom: editPriceFrom ? parseFloat(editPriceFrom) : null,
      priceTo: editPriceTo ? parseFloat(editPriceTo) : null,
    });
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 bg-gray-100/50" />
        <Skeleton className="h-64 bg-gray-100/50" />
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  return (
    <div className="space-y-6">
      {/* Compact Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-teal/10 border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg shadow-primary/20">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Services & Treatments</h2>
            <p className="text-sm text-muted-foreground">{clinicTreatments?.length || 0} services listed</p>
          </div>
        </div>
        <Dialog open={isAddingService} onOpenChange={setIsAddingService}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Add Service
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search treatments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Treatment Grid */}
              <ScrollArea className="h-48">
                <div className="grid grid-cols-2 gap-2 pr-4">
                  {filteredAvailable?.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTreatment(t.id)}
                      className={cn(
                        "p-3 border rounded-xl text-left transition-all hover:shadow-md",
                        selectedTreatment === t.id
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{t.name}</p>
                        {selectedTreatment === t.id && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {filteredAvailable?.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    {searchTerm ? 'No matches found' : 'All treatments added'}
                  </p>
                )}
              </ScrollArea>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div className="space-y-1.5">
                  <Label className="text-xs">Price From ($)</Label>
                  <Input
                    type="number"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Price To ($)</Label>
                  <Input
                    type="number"
                    value={priceTo}
                    onChange={(e) => setPriceTo(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => addTreatment.mutate()}
                disabled={!selectedTreatment || addTreatment.isPending}
              >
                {addTreatment.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Service
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Services List - Compact Cards */}
      {treatmentsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-gray-100/50 rounded-xl" />
          ))}
        </div>
      ) : clinicTreatments && clinicTreatments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {clinicTreatments.map((ct) => (
            <div
              key={ct.id}
              className="flex items-center gap-3 p-4 bg-white/90 rounded-xl border border-slate-700/50 hover:border-gray-300/50 transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{ct.treatment.name}</p>
                {editingId === ct.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={editPriceFrom}
                      onChange={(e) => setEditPriceFrom(e.target.value)}
                      placeholder="Min"
                      className="h-7 w-16 text-xs bg-gray-100 border-gray-300/50 text-gray-900"
                    />
                    <span className="text-gray-900/40">-</span>
                    <Input
                      type="number"
                      value={editPriceTo}
                      onChange={(e) => setEditPriceTo(e.target.value)}
                      placeholder="Max"
                      className="h-7 w-16 text-xs bg-gray-100 border-gray-300/50 text-gray-900"
                    />
                    <Button
                      size="icon"
                      className="h-7 w-7 bg-primary hover:bg-primary/90"
                      onClick={() => saveEdit(ct.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditing(ct)}
                    className="text-left"
                  >
                    {(ct.price_from || ct.price_to) ? (
                      <Badge className="bg-teal/20 text-teal border-0 text-xs mt-1">
                        <DollarSign className="h-3 w-3 mr-0.5" />
                        {ct.price_from && `$${ct.price_from}`}
                        {ct.price_from && ct.price_to && ' - '}
                        {ct.price_to && `$${ct.price_to}`}
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100/50 text-gray-900/50 border-0 text-xs mt-1 hover:bg-slate-600/50">
                        + Add pricing
                      </Badge>
                    )}
                  </button>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeTreatment.mutate(ct.id)}
                className="h-8 w-8 text-gray-900/40 hover:text-coral hover:bg-coral/10 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Card className="bg-white/90 border border-slate-700/50">
          <CardContent className="py-12 text-center">
            <Stethoscope className="h-12 w-12 mx-auto text-gray-900/20 mb-4" />
            <p className="text-gray-900/60 mb-2">No services added yet</p>
            <p className="text-sm text-gray-900/40 mb-4">Add treatments to show patients what you offer</p>
            <Button onClick={() => setIsAddingService(true)} size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Service
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
