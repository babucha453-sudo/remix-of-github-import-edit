import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import ReviewManager from './ReviewManager';

export default function DentistReviewsTab() {
  const { user } = useAuth();

  // Fetch clinic
  const { data: clinic, isLoading } = useQuery({
    queryKey: ['dentist-clinic-reviews', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, google_place_id')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No Practice Linked</h2>
        <p className="text-muted-foreground mb-6">
          Please claim your practice profile first.
        </p>
        <Button asChild>
          <Link to="/claim-profile">Claim Your Profile</Link>
        </Button>
      </div>
    );
  }

  return (
    <ReviewManager
      clinicId={clinic.id}
      clinicName={clinic.name}
      googlePlaceId={clinic.google_place_id || undefined}
    />
  );
}
