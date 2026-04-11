import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewPlaceResult {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
  types?: string[];
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
    authorAttributions?: Array<{ displayName: string; uri: string }>;
  }>;
  reviews?: Array<{
    name: string;
    relativePublishTimeDescription: string;
    rating: number;
    text?: { text: string; languageCode?: string };
    originalText?: { text: string; languageCode?: string };
    authorAttribution?: { displayName: string; uri?: string; photoUri?: string };
    publishTime?: string;
  }>;
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
    weekdayDescriptions?: string[];
  };
  currentOpeningHours?: any;
  editorialSummary?: { text: string; languageCode?: string };
  addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
  adrFormatAddress?: string;
  businessStatus?: string;
  priceLevel?: string;
  utcOffsetMinutes?: number;
  googleMapsUri?: string;
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean };
  delivery?: boolean;
  dineIn?: boolean;
  curbsidePickup?: boolean;
  reservable?: boolean;
  takeout?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesVegetarianFood?: boolean;
}

function extractPlaceId(id: string): string {
  return id.startsWith('places/') ? id.replace('places/', '') : id;
}

function formatTimeFromNew(time: { hour: number; minute: number }): string {
  return `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}`;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseOpeningHoursNew(periods?: Array<{ open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }>) {
  const hours = Array.from({ length: 7 }, (_, day) => ({ day_of_week: day, open_time: null as string | null, close_time: null as string | null, is_closed: true }));
  if (!periods || periods.length === 0) return hours;
  if (periods.length === 1 && !periods[0].close) {
    return hours.map(h => ({ ...h, open_time: '00:00', close_time: '23:59', is_closed: false }));
  }
  for (const period of periods) {
    hours[period.open.day] = {
      day_of_week: period.open.day,
      open_time: formatTimeFromNew(period.open),
      close_time: period.close ? formatTimeFromNew(period.close) : '23:59',
      is_closed: false,
    };
  }
  return hours;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!googleApiKey) {
      return new Response(JSON.stringify({ success: false, error: 'GOOGLE_PLACES_API_KEY not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, batchSize = 10, offset = 0 } = body;

    // ── ACTION: get-place-ids ──────────────────────────────────────
    // Returns all unique place IDs from audit logs for recovery
    if (action === 'get-place-ids') {
      // Paginate through ALL audit logs to avoid the 1000-row default limit
      const placeIdSet = new Set<string>();
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('new_values')
          .eq('entity_type', 'clinic')
          .eq('action', 'GMB_IMPORT')
          .not('new_values', 'is', null)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw new Error(`Failed to read audit logs: ${error.message}`);

        for (const log of logs || []) {
          const nv = log.new_values as Record<string, any>;
          if (nv?.google_place_id) placeIdSet.add(nv.google_place_id);
        }

        hasMore = (logs?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      console.log(`Scanned ${from} audit log rows, found ${placeIdSet.size} unique place IDs`);

      // Check which are already restored
      const allIds = Array.from(placeIdSet);
      const existing = new Set<string>();
      // Check in chunks of 200
      for (let i = 0; i < allIds.length; i += 200) {
        const chunk = allIds.slice(i, i + 200);
        const { data } = await supabase
          .from('clinics')
          .select('google_place_id')
          .in('google_place_id', chunk);
        for (const c of data || []) existing.add(c.google_place_id);
      }

      const remaining = allIds.filter(id => !existing.has(id));

      return new Response(JSON.stringify({
        success: true,
        total_place_ids: allIds.length,
        already_restored: existing.size,
        remaining: remaining.length,
        place_ids: remaining,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ACTION: recover-batch ──────────────────────────────────────
    // Fetches details from Google and inserts clinics + hours + reviews
    if (action === 'recover-batch') {
      const { placeIds } = body as { placeIds: string[] };
      if (!placeIds || placeIds.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'No place IDs provided', imported: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Load active states + cities for assignment
      const { data: activeStates } = await supabase.from('states').select('id, name, abbreviation').eq('is_active', true);
      const stateAbbrevs = new Set((activeStates || []).map(s => s.abbreviation?.toUpperCase()).filter(Boolean));

      const { data: cities } = await supabase
        .from('cities')
        .select('id, name, latitude, longitude, state:states!inner(abbreviation)')
        .eq('is_active', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      const extractStateFromAddress = (address: string) => {
        if (!address) return { abbreviation: null as string | null, isValid: false };
        const parts = address.split(',').map(p => p.trim());
        for (const part of parts) {
          const m = part.match(/^([A-Z]{2})(?:\s+\d{5})?$/);
          if (m) return { abbreviation: m[1], isValid: stateAbbrevs.has(m[1]) };
        }
        return { abbreviation: null as string | null, isValid: false };
      };

      const findNearestCity = (lat: number, lng: number, stateAbbrev: string | null) => {
        let best: { cityId: string; cityName: string; distance: number } | null = null;
        for (const city of cities || []) {
          if (stateAbbrev && (city as any).state?.abbreviation?.toUpperCase() !== stateAbbrev.toUpperCase()) continue;
          const d = haversineDistance(lat, lng, parseFloat(city.latitude as any), parseFloat(city.longitude as any));
          if (d <= 30 && (!best || d < best.distance)) {
            best = { cityId: city.id, cityName: city.name, distance: d };
          }
        }
        return best;
      };

      const imported: string[] = [];
      const errors: string[] = [];
      const skipped: string[] = [];
      const fieldMask = [
        'id','displayName','formattedAddress','nationalPhoneNumber','internationalPhoneNumber',
        'websiteUri','googleMapsUri','location','addressComponents','adrFormatAddress',
        'rating','userRatingCount','reviews','types','businessStatus','priceLevel',
        'utcOffsetMinutes','editorialSummary','photos','regularOpeningHours',
        'currentOpeningHours','accessibilityOptions',
      ].join(',');

      for (const placeId of placeIds) {
        try {
          // Skip if already exists
          const { data: existing } = await supabase.from('clinics').select('id').eq('google_place_id', placeId).maybeSingle();
          if (existing) { skipped.push(placeId); continue; }

          const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
          const resp = await fetch(`https://places.googleapis.com/v1/${resourceName}`, {
            method: 'GET',
            headers: { 'X-Goog-Api-Key': googleApiKey, 'X-Goog-FieldMask': fieldMask },
          });
          const data = await resp.json();

          if (data.error) {
            errors.push(`${placeId}: ${data.error.message || 'API error'}`);
            continue;
          }

          const place: NewPlaceResult = data;
          const actualPlaceId = extractPlaceId(place.id);
          const placeName = place.displayName?.text || 'Unknown';
          const formattedAddress = place.formattedAddress || '';

          // State validation - skip non-active states
          const stateInfo = extractStateFromAddress(formattedAddress);
          if (!stateInfo.isValid) {
            skipped.push(`${actualPlaceId} (${stateInfo.abbreviation || 'unknown state'})`);
            continue;
          }

          // City assignment
          const placeLat = place.location?.latitude;
          const placeLng = place.location?.longitude;
          let cityId: string | null = null;
          let cityName = '';

          if (placeLat && placeLng) {
            const nearest = findNearestCity(placeLat, placeLng, stateInfo.abbreviation);
            if (nearest) { cityId = nearest.cityId; cityName = nearest.cityName; }
          }

          if (!cityId) {
            // Fallback: first city in that state
            const stateCity = (cities || []).find(c => (c as any).state?.abbreviation?.toUpperCase() === stateInfo.abbreviation?.toUpperCase());
            if (stateCity) { cityId = stateCity.id; cityName = stateCity.name; }
          }

          if (!cityId) {
            errors.push(`${placeName}: No city found for state ${stateInfo.abbreviation}`);
            continue;
          }

          // Generate slug
          const baseSlug = placeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const { data: existingSlug } = await supabase.from('clinics').select('id').eq('slug', baseSlug).maybeSingle();
          const slug = existingSlug ? `${baseSlug}-${cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : baseSlug;

          // Download cover photo only (skip gallery for speed)
          let coverImageUrl: string | null = null;
          if (place.photos && place.photos.length > 0) {
            try {
              const photoName = place.photos[0].name;
              const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1600&key=${googleApiKey}`;
              const photoResp = await fetch(photoUrl, { redirect: 'follow' });
              if (photoResp.ok) {
                const blob = await photoResp.arrayBuffer();
                const ct = photoResp.headers.get('content-type') || 'image/jpeg';
                const ext = ct.includes('png') ? 'png' : 'jpg';
                const fileName = `clinics/${slug.substring(0, 30)}/${Date.now()}-0.${ext}`;
                const { error: uploadErr } = await supabase.storage.from('clinic-assets').upload(fileName, blob, { contentType: ct, upsert: false });
                if (!uploadErr) {
                  coverImageUrl = supabase.storage.from('clinic-assets').getPublicUrl(fileName).data.publicUrl;
                }
              }
            } catch (e) { console.warn(`Photo error for ${placeName}:`, e); }
          }

          // Description
          let description = place.editorialSummary?.text || '';
          if (!description && place.reviews?.length) {
            const good = place.reviews.find(r => r.rating >= 4);
            if (good?.text?.text) description = `"${good.text.text.substring(0, 300)}..."`;
          }

          // Business hours
          const businessHours = parseOpeningHoursNew(place.regularOpeningHours?.periods);

          // GMB data blob
          const gmbData = {
            photo_names: place.photos?.map(p => ({ name: p.name, widthPx: p.widthPx, heightPx: p.heightPx })),
            opening_hours_text: place.regularOpeningHours?.weekdayDescriptions,
            opening_hours_periods: place.regularOpeningHours?.periods,
            reviews: place.reviews?.map(r => ({
              author_name: r.authorAttribution?.displayName,
              rating: r.rating,
              text: r.text?.text || r.originalText?.text,
              publish_time: r.publishTime,
            })),
            types: place.types,
            google_maps_url: place.googleMapsUri,
            business_status: place.businessStatus,
            editorial_summary: place.editorialSummary,
            fetched_at: new Date().toISOString(),
            api_version: 'places_v1_new',
            recovery_mode: true,
          };

          // Insert clinic
          const { data: newClinic, error: insertErr } = await supabase.from('clinics').insert({
            name: placeName,
            slug,
            google_place_id: actualPlaceId,
            address: formattedAddress,
            phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
            website: place.websiteUri,
            rating: place.rating || 0,
            review_count: place.userRatingCount || 0,
            latitude: placeLat,
            longitude: placeLng,
            city_id: cityId,
            source: 'gmb',
            claim_status: 'unclaimed',
            verification_status: 'unverified',
            is_active: true,
            description: description || null,
            cover_image_url: coverImageUrl,
            gmb_data: gmbData,
          }).select('id').single();

          if (insertErr) {
            errors.push(`${placeName}: ${insertErr.message}`);
            continue;
          }

          // Insert hours
          if (businessHours.length > 0) {
            await supabase.from('clinic_hours').insert(
              businessHours.map(h => ({ clinic_id: newClinic.id, ...h }))
            );
          }

          // Insert reviews
          if (place.reviews?.length) {
            await supabase.from('google_reviews').insert(
              place.reviews.map(r => ({
                clinic_id: newClinic.id,
                author_name: r.authorAttribution?.displayName || 'Anonymous',
                author_photo_url: r.authorAttribution?.photoUri,
                rating: r.rating,
                text_content: r.text?.text || r.originalText?.text || '',
                review_time: r.publishTime || null,
                google_review_id: `gmb_${actualPlaceId}_${r.name}`,
                synced_at: new Date().toISOString(),
              }))
            );
          }

          imported.push(actualPlaceId);
          console.log(`✓ Recovered: ${placeName} → ${cityName}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${placeId}: ${msg}`);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
        error_details: errors.slice(0, 20),
        imported_ids: imported,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ACTION: status ─────────────────────────────────────────────
    if (action === 'status') {
      const [clinicsRes, hoursRes, reviewsRes, dentistsRes] = await Promise.all([
        supabase.from('clinics').select('id', { count: 'exact', head: true }),
        supabase.from('clinic_hours').select('id', { count: 'exact', head: true }),
        supabase.from('google_reviews').select('id', { count: 'exact', head: true }),
        supabase.from('dentists').select('id', { count: 'exact', head: true }),
      ]);

      return new Response(JSON.stringify({
        success: true,
        counts: {
          clinics: clinicsRes.count ?? 0,
          clinic_hours: hoursRes.count ?? 0,
          google_reviews: reviewsRes.count ?? 0,
          dentists: dentistsRes.count ?? 0,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: get-place-ids, recover-batch, status' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Recovery error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
