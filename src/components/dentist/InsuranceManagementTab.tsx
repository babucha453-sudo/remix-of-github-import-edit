import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Shield,
  Search,
  Save,
  CheckCircle,
  Building2,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { NoPracticeLinked } from './NoPracticeLinked';

interface Insurance {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
}

export default function InsuranceManagementTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInsurances, setSelectedInsurances] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-insurance', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, claim_status')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all active insurances
  const { data: allInsurances, isLoading: insurancesLoading } = useQuery({
    queryKey: ['all-insurances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurances')
        .select('id, name, slug, logo_url, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Insurance[];
    },
  });

  // Fetch clinic's accepted insurances
  const { data: clinicInsurances, isLoading: clinicInsurancesLoading } = useQuery({
    queryKey: ['clinic-insurances', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_insurances')
        .select('insurance_id')
        .eq('clinic_id', clinic?.id);

      if (error) throw error;
      
      // Initialize selected state
      const insuranceIds = new Set<string>((data || []).map(ci => String(ci.insurance_id)));
      setSelectedInsurances(insuranceIds);
      
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Save mutation
  const saveInsurances = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) throw new Error('No clinic found');

      // Delete all existing
      const { error: deleteError } = await supabase
        .from('clinic_insurances')
        .delete()
        .eq('clinic_id', clinic.id);

      if (deleteError) throw deleteError;

      // Insert selected
      if (selectedInsurances.size > 0) {
        const inserts = Array.from(selectedInsurances).map(insuranceId => ({
          clinic_id: clinic.id,
          insurance_id: insuranceId,
        }));

        const { error: insertError } = await supabase
          .from('clinic_insurances')
          .insert(inserts);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-insurances'] });
      toast.success('Insurance preferences saved successfully');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveInsurances.mutateAsync();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleInsurance = (insuranceId: string) => {
    setSelectedInsurances(prev => {
      const next = new Set(prev);
      if (next.has(insuranceId)) {
        next.delete(insuranceId);
      } else {
        next.add(insuranceId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!allInsurances) return;
    setSelectedInsurances(new Set(allInsurances.map(i => i.id)));
  };

  const clearAll = () => {
    setSelectedInsurances(new Set());
  };

  // Filter insurances
  const filteredInsurances = allInsurances?.filter(
    i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group insurances by type (government vs private)
  const governmentSlugs = ['dha', 'haad', 'moh', 'seha', 'thiqa', 'saada'];
  const governmentInsurances = filteredInsurances?.filter(i => 
    governmentSlugs.some(s => i.slug.toLowerCase().includes(s))
  );
  const privateInsurances = filteredInsurances?.filter(i => 
    !governmentSlugs.some(s => i.slug.toLowerCase().includes(s))
  );

  if (clinicLoading || insurancesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Accepted Insurances</h2>
          <p className="text-muted-foreground">
            Select the insurance providers your clinic accepts
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-900 text-white border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{selectedInsurances.size}</p>
                <p className="text-xs text-slate-400">Selected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-teal text-white border-teal">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{allInsurances?.length || 0}</p>
                <p className="text-xs text-teal-100">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gold text-white border-gold">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {governmentInsurances?.filter(i => selectedInsurances.has(i.id)).length || 0}
                </p>
                <p className="text-xs text-gold-light">Government</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Actions */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search insurances..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear All
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Why add insurance information?</p>
              <p className="text-blue-700">
                Patients often search for dentists that accept their insurance. By listing accepted insurances, 
                your clinic will appear in relevant search results and insurance-specific pages.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Government Programs */}
      {governmentInsurances && governmentInsurances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Government Programs
            </CardTitle>
            <CardDescription>
              Government-sponsored insurance programs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {governmentInsurances.map((insurance) => (
                <InsuranceCard
                  key={insurance.id}
                  insurance={insurance}
                  isSelected={selectedInsurances.has(insurance.id)}
                  onToggle={() => toggleInsurance(insurance.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Private Insurers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Private Insurance Providers
          </CardTitle>
          <CardDescription>
            Select all insurance providers your clinic accepts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clinicInsurancesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : privateInsurances && privateInsurances.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {privateInsurances.map((insurance) => (
                <InsuranceCard
                  key={insurance.id}
                  insurance={insurance}
                  isSelected={selectedInsurances.has(insurance.id)}
                  onToggle={() => toggleInsurance(insurance.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No insurances found matching your search</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InsuranceCard({
  insurance,
  isSelected,
  onToggle,
}: {
  insurance: Insurance;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`p-4 border rounded-xl cursor-pointer transition-all flex items-center gap-3 ${
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:border-primary/50 hover:bg-muted/50'
      }`}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        className="pointer-events-none"
      />
      <div className="flex-1 min-w-0">
        {insurance.logo_url ? (
          <img
            src={insurance.logo_url}
            alt={insurance.name}
            className="h-6 object-contain"
          />
        ) : (
          <p className="font-medium text-sm truncate">{insurance.name}</p>
        )}
      </div>
      {isSelected && (
        <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
      )}
    </div>
  );
}
