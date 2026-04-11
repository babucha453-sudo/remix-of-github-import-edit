import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/seo/SEOHead";
import { StructuredData } from "@/components/seo/StructuredData";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { InterlinkingSection } from "@/components/seo/InterlinkingSection";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { MultiStepBookingModal } from "@/components/MultiStepBookingModal";
import { InlineBookingCalendar } from "@/components/booking/InlineBookingCalendar";
import { useToast } from "@/hooks/use-toast";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { useAuth } from "@/hooks/useAuth";
import {
  Star,
  BadgeCheck,
  Calendar,
  Share2,
  Heart,
  Award,
  Languages,
  Briefcase,
  Clock,
  Check,
  Copy
} from "lucide-react";

const DentistPage = () => {
  const { dentistSlug } = useParams();
  const slug = dentistSlug || "";
  const [bookingOpen, setBookingOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareSuccess, setShareSuccess] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { trackProfileView } = useAnalytics();
  const { data: seoContent } = useSeoPageContent(`dentist/${slug}`);

  // Fetch dentist data - only exact slug match
  const { data: dentist, isLoading, error } = useQuery({
    queryKey: ["dentist", slug],
    queryFn: async () => {
      if (!slug || slug.includes('/')) return null; // Prevent path traversal
      const { data, error } = await supabase
        .from("dentists")
        .select("*, clinic:clinics(id, name, slug, address, phone, latitude, longitude, city:cities(name, slug, state:states(name, abbreviation, slug)))")
        .eq("slug", slug)
        .maybeSingle(); // Use maybeSingle to return null instead of error for no match
      if (error) throw error;
      return data;
    },
    enabled: !!slug && !slug.includes('/'),
  });

  // Fetch treatments via clinic_treatments if dentist has a clinic
  const { data: treatments } = useQuery({
    queryKey: ["dentist-clinic-treatments", dentist?.clinic_id],
    queryFn: async () => {
      if (!dentist?.clinic_id) return [];
      const { data } = await supabase
        .from("clinic_treatments")
        .select("*, treatment:treatments(*)")
        .eq("clinic_id", dentist.clinic_id);
      return data || [];
    },
    enabled: !!dentist?.clinic_id,
  });

  // Fetch reviews from review_funnel_events via clinic
  const { data: reviews } = useQuery({
    queryKey: ["dentist-reviews", dentist?.clinic_id],
    queryFn: async () => {
      if (!dentist?.clinic_id) return [];
      const { data } = await supabase
        .from("review_funnel_events")
        .select("*")
        .eq("clinic_id", dentist.clinic_id)
        .eq("event_type", "rating_submitted")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []).map((r: any) => ({
        id: r.id,
        patient_name: r.visitor_id || 'Anonymous',
        rating: r.rating || 5,
        content: r.comment || '',
        created_at: r.created_at,
      }));
    },
    enabled: !!dentist?.clinic_id,
  });

  // Handle share functionality
  const handleShare = async () => {
    const url = window.location.href;
    const title = `${dentist?.name || 'Dentist'} - AppointPanda`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        toast({ title: "Shared successfully!" });
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== 'AbortError') {
          fallbackCopyToClipboard(url);
        }
      }
    } else {
      fallbackCopyToClipboard(url);
    }
  };

  const fallbackCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShareSuccess(true);
      toast({ title: "Link copied to clipboard!" });
      setTimeout(() => setShareSuccess(false), 2000);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  // Handle like functionality
  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    
    // Store in localStorage for persistence
    const likedDentists = JSON.parse(localStorage.getItem('likedDentists') || '[]');
    if (isLiked) {
      const updated = likedDentists.filter((id: string) => id !== dentist?.id);
      localStorage.setItem('likedDentists', JSON.stringify(updated));
      toast({ title: "Removed from favorites" });
    } else {
      likedDentists.push(dentist?.id);
      localStorage.setItem('likedDentists', JSON.stringify(likedDentists));
      toast({ title: "Added to favorites!", description: "Find your favorites in your profile" });
    }
  };

  // Check if already liked on mount
  useEffect(() => {
    if (dentist?.id) {
      const likedDentists = JSON.parse(localStorage.getItem('likedDentists') || '[]');
      setIsLiked(likedDentists.includes(dentist.id));
    }
  }, [dentist?.id]);

  // Track profile view in GA4 when dentist data is available
  useEffect(() => {
    if (dentist?.id && dentist?.name) {
      trackProfileView({
        profile_type: 'dentist',
        profile_id: dentist.id,
        profile_name: dentist.name,
        city: dentist.clinic?.city?.name,
        state: dentist.clinic?.city?.state?.abbreviation,
      });
    }
  }, [dentist?.id, dentist?.name, dentist?.clinic?.city?.name, dentist?.clinic?.city?.state?.abbreviation, trackProfileView]);

  // Signal prerender when data is ready
  const isDataReady = !isLoading && !!dentist;
  usePrerenderReady(isDataReady);

  if (isLoading) {
    return (
      <PageLayout>
        <div className="container py-8">
          <Skeleton className="h-64 rounded-3xl mb-8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!dentist) {
    return (
      <PageLayout>
        <Section>
          <div className="text-center py-20">
            <h1 className="font-display text-3xl font-bold mb-4">Dentist Not Found</h1>
            <p className="text-muted-foreground mb-8">
              The dentist profile you're looking for doesn't exist.
            </p>
            <Button asChild className="rounded-xl font-bold">
              <Link to="/search">Find Dentists</Link>
            </Button>
          </div>
        </Section>
      </PageLayout>
    );
  }

  const cityName = dentist.clinic?.city?.name || 'Unknown';
  const stateAbbr = dentist.clinic?.city?.state?.abbreviation || '';
  const stateSlug = dentist.clinic?.city?.state?.slug || '';
  const citySlug = dentist.clinic?.city?.slug || '';
  const locationDisplay = stateAbbr ? `${cityName}, ${stateAbbr}` : cityName;

  const breadcrumbs = [
    { label: "Dentists", href: "/search" },
    ...(stateSlug ? [{ label: dentist.clinic?.city?.state?.name || '', href: `/${stateSlug}` }] : []),
    ...(citySlug && stateSlug ? [{ label: cityName, href: `/${stateSlug}/${citySlug}` }] : []),
    { label: dentist.name },
  ];

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || `${dentist.name}${dentist.title ? `, ${dentist.title}` : ''} - Dentist in ${locationDisplay}`}
        description={seoContent?.meta_description || dentist.bio || `Book an appointment with ${dentist.name}. ${dentist.years_experience ? `${dentist.years_experience}+ years of experience.` : ''} Verified dental professional in ${locationDisplay}.`}
        canonical={`/dentist/${dentist.slug}/`}
        keywords={[dentist.name, `dentist ${cityName}`, dentist.title || 'dental specialist']}
        ogType="profile"
      />
      <SyncStructuredData
        data={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              ...(stateSlug && citySlug ? [{ name: dentist.clinic?.city?.state?.name || '', url: `/${stateSlug}/` }] : []),
              ...(stateSlug && citySlug ? [{ name: cityName, url: `/${stateSlug}/${citySlug}/` }] : []),
              { name: dentist.name },
            ],
          },
          {
            type: 'dentist',
            name: dentist.name,
            specialty: dentist.title || 'Dental Professional',
            description: dentist.bio || `${dentist.name} is a verified dental professional in ${locationDisplay}.`,
            image: dentist.image_url || undefined,
            url: `/dentist/${dentist.slug}/`,
            worksFor: dentist.clinic ? { name: dentist.clinic.name, url: `/clinic/${dentist.clinic.slug}/` } : undefined,
            address: dentist.clinic?.address || '',
            city: dentist.clinic?.city?.name || '',
            state: dentist.clinic?.city?.state?.abbreviation || '',
            phone: dentist.clinic?.phone || '',
            rating: dentist.rating ? Number(dentist.rating) : undefined,
            reviewCount: dentist.review_count || undefined,
          },
        ]}
        id="dentist-schema"
      />
      {/* Hero Section */}
      <section className="gradient-hero py-12 md:py-16">
        <div className="container">
          <Breadcrumbs items={breadcrumbs} className="mb-8" />
          
          <div className="card-modern p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Photo */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border-4 border-background shadow-elevated">
                  {dentist.image_url ? (
                    <img
                      src={dentist.image_url}
                      alt={dentist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple/20 flex items-center justify-center">
                      <span className="text-4xl font-display font-bold text-primary/50">
                        {dentist.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-start gap-3 mb-2">
                  {dentist.is_active && (
                    <Badge className="bg-gold/10 text-gold border border-gold/20 rounded-full px-3 py-1 font-bold">
                      <Award className="h-4 w-4 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>

                <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">
                  {dentist.name}
                </h1>
                
                {dentist.title && (
                  <p className="text-lg text-muted-foreground font-medium mb-4">
                    {dentist.title}
                  </p>
                )}

                {/* Rating */}
                <div className="flex items-center gap-4 mb-4">
                  {(Number(dentist.rating) || 0) > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-gold">
                        <Star className="h-5 w-5 fill-current" />
                        <span className="font-bold text-lg">{Number(dentist.rating).toFixed(1)}</span>
                      </div>
                      <span className="text-muted-foreground">
                        ({dentist.review_count || 0} reviews)
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Info */}
                <div className="flex flex-wrap gap-4">
                  {dentist.years_experience && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">{dentist.years_experience}+ Years Experience</span>
                    </div>
                  )}
                  {dentist.clinic && (
                    <Link 
                      to={`/clinic/${dentist.clinic.slug}`}
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <Briefcase className="h-4 w-4 text-primary" />
                      <span className="font-medium">{dentist.clinic.name}</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex md:flex-col gap-3">
                <Button size="lg" className="rounded-xl font-bold flex-1 md:flex-none" onClick={() => setBookingOpen(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Appointment
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-xl"
                    onClick={handleShare}
                  >
                    {shareSuccess ? <Check className="h-4 w-4 text-teal" /> : <Share2 className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={`rounded-xl ${isLiked ? 'bg-coral/10 border-coral/30' : ''}`}
                    onClick={handleLike}
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? 'fill-coral text-coral' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <Section size="md">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <div className="card-modern p-6">
              <h2 className="font-display text-xl font-bold mb-4">About</h2>
              <p className="text-muted-foreground leading-relaxed">
                {dentist.bio || `${dentist.name} is a dedicated dental professional committed to providing exceptional patient care. With expertise in various dental procedures and a patient-centered approach, they ensure comfortable and effective treatments.`}
              </p>
            </div>

            {/* Languages */}
            {dentist.languages && dentist.languages.length > 0 && (
              <div className="card-modern p-6">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <Languages className="h-5 w-5 text-primary" />
                  Languages
                </h2>
                <div className="flex flex-wrap gap-2">
                  {dentist.languages.map((lang, i) => (
                    <Badge key={i} variant="secondary" className="rounded-full px-4 py-1 font-medium">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Specializations */}
            {dentist.specializations && dentist.specializations.length > 0 && (
              <div className="card-modern p-6">
                <h2 className="font-display text-xl font-bold mb-4">Specializations</h2>
                <div className="flex flex-wrap gap-2">
                  {dentist.specializations.map((spec, i) => (
                    <Badge key={i} variant="outline" className="rounded-full px-4 py-1 font-medium">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Services from clinic */}
            {treatments && treatments.length > 0 && (
              <div className="card-modern p-6">
                <h2 className="font-display text-xl font-bold mb-4">Services Offered</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {treatments.map((dt) => (
                    <Link
                      key={dt.id}
                      to={`/services/${dt.treatment?.slug}`}
                      className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="text-2xl">{dt.treatment?.icon || "🦷"}</span>
                      <span className="font-bold">{dt.treatment?.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="card-modern p-6">
              <h2 className="font-display text-xl font-bold mb-4">Patient Reviews</h2>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-4 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="font-bold text-primary">
                            {review.patient_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold">{review.patient_name}</p>
                          <div className="flex items-center gap-1 text-gold text-sm">
                            {[...Array(review.rating || 5)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </div>
                        </div>
                      </div>
                      {review.content && (
                        <p className="text-muted-foreground">{review.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No reviews yet.</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Clinic Card */}
            {dentist.clinic && (
              <div className="card-modern p-6">
                <h3 className="font-display font-bold mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Works At
                </h3>
                <Link 
                  to={`/clinic/${dentist.clinic.slug}`}
                  className="block p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <p className="font-bold text-lg">{dentist.clinic.name}</p>
                  {dentist.clinic.city && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {locationDisplay}
                    </p>
                  )}
                </Link>
              </div>
            )}

            {/* Inline Booking Calendar */}
            <div className="lg:sticky lg:top-24">
              <InlineBookingCalendar
                profileId={dentist.id}
                profileName={dentist.name}
                profileType="dentist"
                clinicId={dentist.clinic_id || undefined}
                clinicLatitude={dentist.clinic?.latitude ? Number(dentist.clinic.latitude) : undefined}
                clinicLongitude={dentist.clinic?.longitude ? Number(dentist.clinic.longitude) : undefined}
                clinicAddress={dentist.clinic?.address || undefined}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Interlinking Section */}
      <Section size="md">
        <InterlinkingSection
          variant="dentist"
          currentLocationName={cityName}
          currentLocationSlug={citySlug}
          citySlug={stateSlug ? `${stateSlug}/${citySlug}` : citySlug}
          relatedServices={(treatments || []).map(t => ({
            name: t.treatment?.name || '',
            slug: t.treatment?.slug || ''
          })).filter(t => t.name)}
        />
      </Section>
      
      {/* Multi-Step Booking Modal */}
      <MultiStepBookingModal
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        profileId={dentist.id}
        profileName={dentist.name}
        profileType="dentist"
        clinicId={dentist.clinic_id || undefined}
        clinicLatitude={dentist.clinic?.latitude ? Number(dentist.clinic.latitude) : undefined}
        clinicLongitude={dentist.clinic?.longitude ? Number(dentist.clinic.longitude) : undefined}
        clinicAddress={dentist.clinic?.address || undefined}
      />
    </PageLayout>
  );
};

export default DentistPage;