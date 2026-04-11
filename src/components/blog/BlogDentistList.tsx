import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileCard } from '@/components/ProfileCard';
import type { Profile } from '@/hooks/useProfiles';

interface BlogDentistListProps {
  clinicIds?: string[];
  clinicSlugs?: string[];
  locationLabel?: string;
  headingText?: string;
}

export function BlogDentistList({
  clinicIds = [],
  clinicSlugs = [],
  locationLabel,
  headingText,
}: BlogDentistListProps) {
  const keyIds = Array.isArray(clinicIds) ? clinicIds.filter(Boolean) : [];
  const keySlugs = Array.isArray(clinicSlugs) ? clinicSlugs.filter(Boolean) : [];

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['blog-top-clinics', { ids: keyIds, slugs: keySlugs }],
    queryFn: async () => {
      if (!keyIds.length && !keySlugs.length) return [] as Profile[];

      const query = supabase
        .from('clinics')
        .select(
          `
          id,
          name,
          slug,
          cover_image_url,
          rating,
          review_count,
          verification_status,
          claim_status,
          city:cities(name, slug, state:states(abbreviation))
        `
        )
        .eq('is_active', true);

      const { data } = keyIds.length
        ? await query.in('id', keyIds)
        : await query.in('slug', keySlugs);

      const rows = (data || []) as any[];

      // Preserve original order
      const byId = new Map(rows.map((r) => [r.id, r]));
      const bySlug = new Map(rows.map((r) => [r.slug, r]));
      const ordered = keyIds.length
        ? keyIds.map((id) => byId.get(id)).filter(Boolean)
        : keySlugs.map((s) => bySlug.get(s)).filter(Boolean);

      return ordered.map((c: any) => {
        const stateAbbr = c.city?.state?.abbreviation;
        const loc = c.city?.name
          ? `${c.city.name}${stateAbbr ? `, ${stateAbbr}` : ''}`
          : locationLabel || 'United States';

        const isVerified = c.claim_status === 'claimed' && c.verification_status === 'verified';

        const profile: Profile = {
          id: c.id,
          name: c.name,
          slug: c.slug,
          type: 'clinic',
          specialty: 'Dental Clinic',
          location: loc,
          rating: Number(c.rating) || 0,
          reviewCount: c.review_count || 0,
          image: c.cover_image_url || undefined,
          isVerified,
          clinicName: c.name,
          clinicId: c.id,
        };

        return profile;
      });
    },
    enabled: keyIds.length > 0 || keySlugs.length > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 my-8 not-prose">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!profiles?.length) return null;

  const title = headingText || `Top ${profiles.length} Dentists${locationLabel ? ` in ${locationLabel}` : ''}`;

  return (
    <div className="my-10 not-prose">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="space-y-4">
        {profiles.map((p) => (
          <ProfileCard key={p.id} profile={p} variant="list" />
        ))}
      </div>
    </div>
  );
}
