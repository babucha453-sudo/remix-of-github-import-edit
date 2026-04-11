import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarBookingForm } from '@/components/booking/CalendarBookingForm';
import { Skeleton } from '@/components/ui/skeleton';
import { SEOHead } from '@/components/seo/SEOHead';

/**
 * BookDirectPage - Direct booking page for GMB integration
 * 
 * This page is the target of the "Book Appointment" button on Google Business Profiles.
 * It provides a streamlined booking experience without requiring navigation through
 * the full clinic page.
 * 
 * URL: /book/:clinicId
 */
export default function BookDirectPage() {
  const { clinicId } = useParams<{ clinicId: string }>();

  const { data: clinic, isLoading, error } = useQuery({
    queryKey: ['clinic-booking', clinicId],
    queryFn: async () => {
      if (!clinicId) throw new Error('No clinic ID');

      const { data, error } = await supabase
        .from('clinics')
        .select(`
          id,
          name,
          slug,
          address,
          latitude,
          longitude,
          phone,
          cover_image_url,
          city:cities(name),
          area:areas(name)
        `)
        .eq('id', clinicId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Track page view for analytics
  useQuery({
    queryKey: ['track-booking-view', clinicId],
    queryFn: async () => {
      if (!clinicId) return null;
      
      await supabase.functions.invoke('track-profile-view', {
        body: { 
          clinicId, 
          source: 'gmb_booking_link',
          eventType: 'booking_page_view'
        }
      });
      
      return true;
    },
    enabled: !!clinicId,
    staleTime: Infinity, // Only track once per session
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !clinic) {
    // Redirect to home if clinic not found
    return <Navigate to="/" replace />;
  }

  const locationDisplay = [
    (clinic.area as any)?.name,
    (clinic.city as any)?.name,
  ].filter(Boolean).join(', ');

  return (
    <>
      <SEOHead
        title={`Book Appointment - ${clinic.name}`}
        description={`Book an appointment online with ${clinic.name}${locationDisplay ? ` in ${locationDisplay}` : ''}. Quick and easy online scheduling.`}
        noindex={true}
      />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              {clinic.cover_image_url ? (
                <img 
                  src={clinic.cover_image_url} 
                  alt={clinic.name}
                  className="h-12 w-12 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {clinic.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-semibold text-foreground">{clinic.name}</h1>
                {locationDisplay && (
                  <p className="text-sm text-muted-foreground">{locationDisplay}</p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Booking Form */}
        <main className="container max-w-lg mx-auto px-4 py-6">
          <div className="bg-card rounded-2xl border shadow-lg overflow-hidden">
            <CalendarBookingForm
              profileId={clinic.id}
              profileName={clinic.name}
              profileType="clinic"
              clinicId={clinic.id}
              clinicLatitude={clinic.latitude}
              clinicLongitude={clinic.longitude}
              clinicAddress={clinic.address}
              onClose={() => {
                // Redirect to clinic page after booking
                window.location.href = `/clinic/${clinic.slug}`;
              }}
            />
          </div>

          {/* Trust indicators */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Powered by AppointPanda
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
                Secure Booking
              </span>
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Instant Confirmation
              </span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
