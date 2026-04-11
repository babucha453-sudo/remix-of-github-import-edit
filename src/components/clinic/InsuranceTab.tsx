import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface InsuranceTabProps {
  clinicId: string;
  isClaimed: boolean;
}

export function InsuranceTab({ clinicId, isClaimed }: InsuranceTabProps) {
  // Fetch clinic's accepted insurances
  const { data: clinicInsurances, isLoading: loadingClinic } = useQuery({
    queryKey: ['clinic-insurances', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_insurances')
        .select('*, insurance:insurances(*)')
        .eq('clinic_id', clinicId);
      return data || [];
    },
    enabled: !!clinicId && isClaimed,
  });

  // Fetch all insurances for reference
  const { data: allInsurances, isLoading: loadingAll } = useQuery({
    queryKey: ['all-insurances'],
    queryFn: async () => {
      const { data } = await supabase
        .from('insurances')
        .select('*')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  if (loadingClinic || loadingAll) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const acceptedIds = new Set(clinicInsurances?.map(ci => ci.insurance_id) || []);
  const governmentInsurances = allInsurances?.filter(i => 
    ['medicaid', 'medicare', 'tricare'].includes(i.slug)
  ) || [];
  const privateInsurances = allInsurances?.filter(i => 
    !['medicaid', 'medicare', 'tricare'].includes(i.slug)
  ) || [];

  if (!isClaimed) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-2xl">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-bold text-foreground mb-2">Insurance Information</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Insurance details will be available once this clinic claims their profile.
          Contact the clinic directly to verify insurance acceptance.
        </p>
      </div>
    );
  }

  if (clinicInsurances?.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 bg-muted/30 rounded-2xl">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-bold text-foreground mb-2">Insurance Not Listed Yet</h3>
          <p className="text-muted-foreground text-sm">
            This clinic hasn't added their accepted insurances yet.
            Please contact them directly to verify coverage.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Common Insurance Providers
          </h4>
          <div className="flex flex-wrap gap-2">
            {allInsurances?.slice(0, 12).map((insurance) => (
              <Badge
                key={insurance.id}
                variant="outline"
                className="rounded-full px-3 py-1.5"
              >
                {insurance.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accepted Insurances */}
      <div>
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Accepted Insurance Providers
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clinicInsurances?.map((ci) => (
            <div
              key={ci.id}
              className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl"
            >
              {ci.insurance?.logo_url ? (
                <img 
                  src={ci.insurance.logo_url} 
                  alt={ci.insurance.name}
                  className="h-8 w-8 object-contain"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
              )}
              <span className="font-medium text-foreground">{ci.insurance?.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Government Programs */}
      {governmentInsurances.some(g => acceptedIds.has(g.id)) && (
        <div>
          <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald" />
            Government Programs Accepted
          </h4>
          <div className="flex flex-wrap gap-2">
            {governmentInsurances.filter(g => acceptedIds.has(g.id)).map((insurance) => (
              <Badge
                key={insurance.id}
                className="bg-emerald/10 text-emerald border-emerald/20 rounded-full px-4 py-1.5"
              >
                <CheckCircle className="h-3 w-3 mr-1.5" />
                {insurance.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
        <p>
          💡 <strong>Note:</strong> Coverage may vary by plan. Please verify your specific 
          coverage with your insurance provider before your appointment.
        </p>
      </div>
    </div>
  );
}
