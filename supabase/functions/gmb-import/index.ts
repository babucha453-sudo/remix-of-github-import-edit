import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const SearchSchema = z.object({
  action: z.literal('search'),
  category: z.string().min(1, "Category required").max(100, "Category too long"),
  city: z.string().min(1, "City required").max(100, "City too long"),
  state: z.string().max(100, "State too long").optional(),
  area: z.string().max(100, "Area too long").optional(),
  pageToken: z.string().max(2000, "Page token too long").optional(),
  radius: z.number().min(100).max(50000).default(5000),
});

const ImportSchema = z.object({
  action: z.literal('import'),
  placeIds: z.array(z.string().min(1).max(500)).min(1, "At least one place ID required").max(50, "Maximum 50 places per batch"),
  cityId: z.string().uuid("Invalid city ID format"),
  areaId: z.string().uuid("Invalid area ID format").optional(),
  sessionId: z.string().uuid("Invalid session ID format").optional(),
});

const CheckDuplicatesSchema = z.object({
  action: z.literal('check-duplicates'),
  name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

const SyncSchema = z.object({
  action: z.literal('sync'),
  placeId: z.string().min(1, "Place ID required"),
  clinicId: z.string().uuid("Invalid clinic ID format"),
});

const RequestSchema = z.discriminatedUnion('action', [
  SearchSchema,
  ImportSchema,
  CheckDuplicatesSchema,
  SyncSchema,
]);

// New Places API response interfaces
interface NewPlaceResult {
  id: string; // Format: "places/ChIJ..." - need to extract place_id
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
    name: string; // Format: "places/ChIJ.../photos/..."
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
    authorAttribution?: {
      displayName: string;
      uri?: string;
      photoUri?: string;
    };
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
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
  adrFormatAddress?: string;
  businessStatus?: string;
  priceLevel?: string;
  utcOffsetMinutes?: number;
  googleMapsUri?: string;
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
  };
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

// Helper to extract place_id from new API format "places/ChIJ..."
function extractPlaceId(id: string): string {
  if (id.startsWith('places/')) {
    return id.replace('places/', '');
  }
  return id;
}

// Helper to format time from new API format {hour, minute} to "HH:MM"
function formatTimeFromNew(time: { hour: number; minute: number }): string {
  const hour = time.hour.toString().padStart(2, '0');
  const minute = time.minute.toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

// Haversine formula to calculate distance between two lat/lng points in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find the nearest city for a given lat/lng within the same state
// Find the nearest city for a given lat/lng - STRICT geo-precision to prevent wrong city assignments
async function findNearestCity(
  supabase: any, 
  lat: number, 
  lng: number, 
  stateAbbrev: string | null,
  maxDistanceKm: number = 25 // Reduced to 25km for stricter precision - dentists must be within city bounds
): Promise<{ cityId: string; cityName: string; distance: number } | null> {
  // Fetch all active cities in the state with coordinates
  const query = supabase
    .from('cities')
    .select('id, name, latitude, longitude, state:states!inner(abbreviation)')
    .eq('is_active', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  
  if (stateAbbrev) {
    query.eq('state.abbreviation', stateAbbrev.toUpperCase());
  }
  
  const { data: cities, error } = await query;
  
  if (error || !cities || cities.length === 0) {
    console.log(`No cities found for state ${stateAbbrev}`);
    return null;
  }
  
  let nearestCity: { cityId: string; cityName: string; distance: number } | null = null;
  
  for (const city of cities) {
    if (!city.latitude || !city.longitude) continue;
    
    const distance = haversineDistance(
      lat, lng,
      parseFloat(city.latitude), parseFloat(city.longitude)
    );
    
    if (distance <= maxDistanceKm && (!nearestCity || distance < nearestCity.distance)) {
      nearestCity = {
        cityId: city.id,
        cityName: city.name,
        distance
      };
    }
  }
  
  return nearestCity;
}

// Helper to parse opening hours from new API periods array
function parseOpeningHoursNew(periods?: Array<{ open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }>): Array<{ day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }> {
  const hours: Array<{ day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }> = [];
  
  // Initialize all days as closed
  for (let day = 0; day < 7; day++) {
    hours.push({ day_of_week: day, open_time: null, close_time: null, is_closed: true });
  }
  
  if (!periods || periods.length === 0) {
    return hours;
  }
  
  // Check for 24/7 business (single period with day 0, no close)
  if (periods.length === 1 && !periods[0].close) {
    for (let day = 0; day < 7; day++) {
      hours[day] = { day_of_week: day, open_time: '00:00', close_time: '23:59', is_closed: false };
    }
    return hours;
  }
  
  // Parse each period
  for (const period of periods) {
    const day = period.open.day;
    const openTime = formatTimeFromNew(period.open);
    const closeTime = period.close ? formatTimeFromNew(period.close) : '23:59';
    
    hours[day] = {
      day_of_week: day,
      open_time: openTime,
      close_time: closeTime,
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // SECURITY FIX: Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse action to check if it's a sync (which can be done by clinic owner)
    const body = await req.json();
    const action = body.action;

    // For sync action, allow clinic owners (not just admins)
    if (action === 'sync') {
      // Verify user owns the clinic or is admin
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .select('claimed_by, name')
        .eq('id', body.clinicId)
        .single();
      
      const isOwner = clinic?.claimed_by === user.id;
      
      // Check if admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['super_admin', 'district_manager']);
      
      const isAdmin = roles && roles.length > 0;
      
      if (!isOwner && !isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Must be clinic owner or admin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Sync authorized: user ${user.id} (owner: ${isOwner}, admin: ${isAdmin}) for clinic ${body.clinicId}`);
    } else {
      // For other actions (search, import), require admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['super_admin', 'district_manager']);
      
      if (!roles || roles.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`Admin user verified: ${user.email}`);
    }

    // Re-parse body after auth check

    // Try to get Google API key from environment first, then fall back to global_settings
    let googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    let keySource = 'environment';
    
    // If env key doesn't exist or is empty, try global_settings
    if (!googleApiKey || googleApiKey.trim() === '') {
      console.log('GOOGLE_PLACES_API_KEY not in env, checking global_settings...');
      const { data: settingsData, error: settingsError } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'google_places')
        .single();
      
      if (settingsError) {
        console.error('Error fetching google_places settings:', settingsError.message);
      }
      
      if (settingsData?.value && typeof settingsData.value === 'object') {
        const settings = settingsData.value as Record<string, unknown>;
        googleApiKey = settings.api_key as string;
        if (googleApiKey && googleApiKey.trim() !== '') {
          keySource = 'global_settings';
          console.log('Using Google Places API key from global_settings');
        }
      }
    } else {
      console.log('Using Google Places API key from environment secrets');
    }

    if (!googleApiKey || googleApiKey.trim() === '') {
      console.error('GOOGLE_PLACES_API_KEY not configured in environment or global_settings');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Google Places API key not configured. Please add your API key in Admin → Settings → Google APIs.',
          requiresSetup: true,
          setupInstructions: 'Create a new API key in Google Cloud Console with NO restrictions or IP restrictions only. HTTP referrer restrictions do NOT work with server-side Places API calls.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Google API key source: ${keySource}, key prefix: ${googleApiKey.substring(0, 10)}...`);
    
    // Parse and validate input
    const body = await req.json();
    const validationResult = RequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.issues);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid input', 
          details: validationResult.error.issues.map(i => i.message)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const params = validationResult.data;
    console.log(`GMB Import action: ${params.action}`, params);

    // Fetch active states for validation
    const { data: activeStates } = await supabase
      .from('states')
      .select('id, name, abbreviation, slug')
      .eq('is_active', true);
    
    const activeStateAbbreviations = new Set(
      (activeStates || []).map(s => s.abbreviation?.toUpperCase()).filter(Boolean)
    );
    const activeStateNames = new Set(
      (activeStates || []).map(s => s.name?.toLowerCase()).filter(Boolean)
    );
    
    // Helper function to extract state from address
    const extractStateFromAddress = (address: string): { abbreviation: string | null; isValid: boolean } => {
      if (!address) return { abbreviation: null, isValid: false };
      
      // Common patterns: "City, ST 12345, USA" or "City, State, USA"
      const parts = address.split(',').map(p => p.trim());
      
      for (const part of parts) {
        // Check for state abbreviation (2 letters, possibly followed by zip)
        const abbrevMatch = part.match(/^([A-Z]{2})(?:\s+\d{5})?$/);
        if (abbrevMatch) {
          const abbrev = abbrevMatch[1].toUpperCase();
          return { 
            abbreviation: abbrev, 
            isValid: activeStateAbbreviations.has(abbrev) 
          };
        }
        
        // Check for full state name
        const lowerPart = part.toLowerCase();
        if (activeStateNames.has(lowerPart)) {
          const matchedState = activeStates?.find(s => s.name?.toLowerCase() === lowerPart);
          return { 
            abbreviation: matchedState?.abbreviation || null, 
            isValid: true 
          };
        }
      }
      
      return { abbreviation: null, isValid: false };
    };

    switch (params.action) {
      case 'search': {
        const { category, city, state, area, pageToken } = params;

        // Build search query (US-only)
        const textQuery = `${category} in ${area ? `${area}, ` : ''}${city}${state ? `, ${state}` : ''}, United States`;

        console.log('Searching with NEW Places API:', textQuery, pageToken ? `(page token: ${pageToken.substring(0, 20)}...)` : '(first page)');

        // Build request body with optional page token for pagination
        const requestBody: any = {
          textQuery,
          pageSize: 20,
          languageCode: 'en',
          regionCode: 'US',
        };
        
        // Add page token for pagination if provided
        if (pageToken && pageToken.trim() !== '') {
          requestBody.pageToken = pageToken;
        }

        // Use NEW Places API (v1) - Text Search with pagination support
        const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleApiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types,nextPageToken',
          },
          body: JSON.stringify(requestBody),
        });

        const searchData = await searchResponse.json();

        // Handle errors
        if (searchData.error) {
          console.error('Google Places API (New) error:', searchData.error);
          
          const errorCode = searchData.error.code;
          const errorMessage = searchData.error.message || 'Unknown error';
          const errorStatus = searchData.error.status || 'ERROR';
          
          // Handle specific error cases
          if (errorStatus === 'PERMISSION_DENIED' || errorCode === 403) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Google API error: ${errorMessage}`,
                solution: 'Please enable "Places API (New)" in your Google Cloud Console: APIs & Services → Library → Search "Places API (New)" → Enable',
                requiresSetup: true,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({
              success: false,
              error: `Google API error: ${errorStatus} - ${errorMessage}`,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const places: NewPlaceResult[] = searchData.places || [];
        
        // Get existing place IDs to mark duplicates
        const placeIds = places.map(p => extractPlaceId(p.id));
        const { data: existingClinics } = await supabase
          .from('clinics')
          .select('google_place_id')
          .in('google_place_id', placeIds);
        
        const existingPlaceIds = new Set(existingClinics?.map(c => c.google_place_id) || []);
        
        // Map results with import status - FILTER to only include valid states
        const allResults = places.map((place: NewPlaceResult) => {
          const placeId = extractPlaceId(place.id);
          const address = place.formattedAddress || '';
          const stateInfo = extractStateFromAddress(address);
          
          return {
            place_id: placeId,
            name: place.displayName?.text || 'Unknown',
            address: address,
            rating: place.rating,
            reviews_count: place.userRatingCount,
            lat: place.location?.latitude,
            lng: place.location?.longitude,
            types: place.types,
            already_imported: existingPlaceIds.has(placeId),
            state_abbreviation: stateInfo.abbreviation,
            is_valid_state: stateInfo.isValid,
          };
        });
        
        // Filter to only show results from active states
        const validResults = allResults.filter((r: any) => r.is_valid_state);
        const filteredCount = allResults.length - validResults.length;
        
        if (filteredCount > 0) {
          console.log(`Filtered out ${filteredCount} results from inactive states`);
        }
        
        // Extract nextPageToken from response for pagination
        const nextPageToken = searchData.nextPageToken || null;
        
        console.log(`Found ${validResults.length} valid results`, nextPageToken ? '(more pages available)' : '(last page)');
        
        return new Response(
          JSON.stringify({
            success: true,
            results: validResults,
            next_page_token: nextPageToken, // Now properly returns next page token
            total_found: validResults.length,
            filtered_out: filteredCount,
            has_more: !!nextPageToken,
            api_version: 'places_v1_new',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'import': {
        const { placeIds, cityId, areaId } = params;
        
        const imported: string[] = [];
        const duplicates: string[] = [];
        const errors: string[] = [];
        
        for (const placeId of placeIds) {
          try {
            // Check if already exists
            const { data: existing } = await supabase
              .from('clinics')
              .select('id')
              .eq('google_place_id', placeId)
              .maybeSingle();
            
            if (existing) {
              duplicates.push(placeId);
              continue;
            }
            
            // Fetch place details using NEW Places API (v1)
            // The placeId needs to be prefixed with "places/" for the new API
            const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
            
            const detailsResponse = await fetch(`https://places.googleapis.com/v1/${resourceName}`, {
              method: 'GET',
              headers: {
                'X-Goog-Api-Key': googleApiKey,
                'X-Goog-FieldMask': [
                  'id',
                  'displayName',
                  'formattedAddress',
                  'nationalPhoneNumber',
                  'internationalPhoneNumber',
                  'websiteUri',
                  'googleMapsUri',
                  'location',
                  'addressComponents',
                  'adrFormatAddress',
                  'rating',
                  'userRatingCount',
                  'reviews',
                  'types',
                  'businessStatus',
                  'priceLevel',
                  'utcOffsetMinutes',
                  'editorialSummary',
                  'photos',
                  'regularOpeningHours',
                  'currentOpeningHours',
                  'accessibilityOptions',
                  'delivery',
                  'dineIn',
                  'curbsidePickup',
                  'reservable',
                  'takeout',
                  'servesBreakfast',
                  'servesBrunch',
                  'servesLunch',
                  'servesDinner',
                  'servesBeer',
                  'servesWine',
                  'servesVegetarianFood',
                ].join(','),
              },
            });
            
            const detailsData = await detailsResponse.json();
            
            // Handle errors
            if (detailsData.error) {
              const errorMsg = detailsData.error.message || 'Unknown error';
              console.error(`Failed to fetch place ${placeId}:`, detailsData.error);
              
              if (detailsData.error.code === 403 || detailsData.error.status === 'PERMISSION_DENIED') {
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: 'API Key Configuration Error: Please enable "Places API (New)" in Google Cloud Console.',
                    solution: 'Go to APIs & Services → Library → Search "Places API (New)" → Enable',
                    requiresSetup: true,
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              errors.push(`Failed to fetch ${placeId}: ${errorMsg}`);
              continue;
            }
            
            const place: NewPlaceResult = detailsData;
            const actualPlaceId = extractPlaceId(place.id);
            const placeName = place.displayName?.text || 'Unknown';
            const formattedAddress = place.formattedAddress || '';
            
            // VALIDATE: Check that this business is in an active state
            const addressStateInfo = extractStateFromAddress(formattedAddress);
            if (!addressStateInfo.isValid) {
              console.warn(`Skipping ${placeName} - address "${formattedAddress}" is not in an active state (detected: ${addressStateInfo.abbreviation || 'unknown'})`);
              errors.push(`${placeName}: Not in an active state (${addressStateInfo.abbreviation || 'unknown state'}). Only importing from: ${Array.from(activeStateAbbreviations).join(', ')}`);
              continue;
            }
            
            console.log(`Processing place: ${placeName} in ${addressStateInfo.abbreviation} with ${place.photos?.length || 0} photos`);
            
            // SMART CITY ASSIGNMENT: Use lat/lng to find the exact city
            let actualCityId = cityId;
            let actualCityName = '';
            
            const placeLat = place.location?.latitude;
            const placeLng = place.location?.longitude;
            
            if (placeLat && placeLng && addressStateInfo.abbreviation) {
              console.log(`Finding nearest city for ${placeName} at (${placeLat}, ${placeLng}) in ${addressStateInfo.abbreviation}...`);
              
              const nearestCity = await findNearestCity(
                supabase,
                placeLat,
                placeLng,
                addressStateInfo.abbreviation,
                30 // Max 30km radius - stricter to ensure accuracy
              );
              
              if (nearestCity) {
                actualCityId = nearestCity.cityId;
                actualCityName = nearestCity.cityName;
                console.log(`✓ Matched ${placeName} to ${nearestCity.cityName} (${nearestCity.distance.toFixed(2)}km away)`);
              } else {
                // Fallback: use provided cityId but log warning
                const { data: fallbackCity } = await supabase
                  .from('cities')
                  .select('name')
                  .eq('id', cityId)
                  .single();
                actualCityName = fallbackCity?.name || 'Unknown';
                console.warn(`⚠️ No nearby city found for ${placeName} at (${placeLat}, ${placeLng}) - using fallback: ${actualCityName}`);
              }
            } else {
              // No coordinates - use provided cityId
              const { data: fallbackCity } = await supabase
                .from('cities')
                .select('name')
                .eq('id', cityId)
                .single();
              actualCityName = fallbackCity?.name || 'Unknown';
              console.log(`Using provided cityId for ${placeName} (no coordinates available)`);
            }
            
            // Generate clean slug
            const baseSlug = placeName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
            
            // Check if slug already exists and add city suffix if needed
            const { data: existingSlug } = await supabase
              .from('clinics')
              .select('id')
              .eq('slug', baseSlug)
              .maybeSingle();
            
            let slug = baseSlug;
            if (existingSlug) {
              if (actualCityName) {
                slug = `${baseSlug}-${actualCityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              } else {
                slug = `${baseSlug}-${Date.now().toString(36)}`;
              }
            }
            
            // Download and persist ALL photos to Supabase Storage - NO LIMIT
            let coverImageUrl: string | null = null;
            const photoUrls: string[] = [];
            const maxPhotos = place.photos?.length || 0; // Fetch ALL photos
            
            if (place.photos && place.photos.length > 0) {
              console.log(`Downloading ALL ${maxPhotos} photos for ${placeName}...`);
              
              for (let i = 0; i < maxPhotos; i++) {
                const photoName = place.photos[i]?.name;
                if (!photoName) continue;
                
                try {
                  const maxWidth = i === 0 ? 1600 : 1200; // Highest quality
                  // New API photo URL format
                  const googlePhotoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${googleApiKey}`;
                  
                  // Download the image from Google
                  const photoResponse = await fetch(googlePhotoUrl, { redirect: 'follow' });
                  if (!photoResponse.ok) {
                    console.warn(`Failed to download photo ${i} for ${placeName}: ${photoResponse.status}`);
                    continue;
                  }
                  
                  const photoBlob = await photoResponse.arrayBuffer();
                  const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';
                  const extension = contentType.includes('png') ? 'png' : 'jpg';
                  
                  // Create a unique filename
                  const sanitizedName = slug.substring(0, 30);
                  const fileName = `clinics/${sanitizedName}/${Date.now()}-${i}.${extension}`;
                  
                  // Upload to Supabase Storage
                  const { error: uploadError } = await supabase.storage
                    .from('clinic-assets')
                    .upload(fileName, photoBlob, {
                      contentType,
                      upsert: false,
                    });
                  
                  if (uploadError) {
                    console.warn(`Failed to upload photo ${i} for ${placeName}:`, uploadError);
                    continue;
                  }
                  
                  // Get the public URL
                  const { data: publicUrlData } = supabase.storage
                    .from('clinic-assets')
                    .getPublicUrl(fileName);
                  
                  const permanentUrl = publicUrlData.publicUrl;
                  photoUrls.push(permanentUrl);
                  
                  // First photo is the cover image
                  if (i === 0) {
                    coverImageUrl = permanentUrl;
                  }
                  
                  console.log(`Uploaded photo ${i + 1}/${maxPhotos} for ${placeName}`);
                } catch (photoErr) {
                  console.warn(`Error processing photo ${i} for ${placeName}:`, photoErr);
                }
              }
              
              console.log(`Successfully stored ${photoUrls.length}/${maxPhotos} photos for ${placeName}`);
            }
            
            // Build description from editorial summary or reviews
            let description = '';
            if (place.editorialSummary?.text) {
              description = place.editorialSummary.text;
            } else if (place.reviews && place.reviews.length > 0) {
              const positiveReview = place.reviews.find((r) => r.rating >= 4);
              if (positiveReview && positiveReview.text?.text) {
                description = `"${positiveReview.text.text.substring(0, 300)}..."`;
              }
            }
            
            // Parse business hours from new API format
            const businessHours = parseOpeningHoursNew(place.regularOpeningHours?.periods);
            
            // Store ALL GMB data with COMPLETE metadata - everything Google provides (new format)
            const gmbData = {
              // Photos
              photo_names: place.photos?.map((p) => ({
                name: p.name,
                widthPx: p.widthPx,
                heightPx: p.heightPx,
                authorAttributions: p.authorAttributions,
              })),
              photos_persisted: photoUrls.length,
              total_photos_available: place.photos?.length || 0,
              
              // Business hours - all formats
              opening_hours_text: place.regularOpeningHours?.weekdayDescriptions,
              opening_hours_periods: place.regularOpeningHours?.periods,
              opening_hours_open_now: place.regularOpeningHours?.openNow,
              current_opening_hours: place.currentOpeningHours,
              
              // Reviews - complete data (new format)
              reviews: place.reviews?.map((r) => ({
                name: r.name,
                author_name: r.authorAttribution?.displayName,
                author_url: r.authorAttribution?.uri,
                profile_photo_url: r.authorAttribution?.photoUri,
                rating: r.rating,
                text: r.text?.text || r.originalText?.text,
                publish_time: r.publishTime,
                relative_time_description: r.relativePublishTimeDescription,
                language: r.text?.languageCode,
              })),
              total_reviews_fetched: place.reviews?.length || 0,
              
              // Business types/categories
              types: place.types,
              primary_type: place.types?.[0],
              
              // Location data
              google_maps_url: place.googleMapsUri,
              address_components: place.addressComponents?.map((c) => ({
                long_name: c.longText,
                short_name: c.shortText,
                types: c.types,
              })),
              adr_address: place.adrFormatAddress,
              
              // Business status and info
              business_status: place.businessStatus,
              price_level: place.priceLevel,
              utc_offset_minutes: place.utcOffsetMinutes,
              editorial_summary: place.editorialSummary,
              
              // Service attributes (what services they offer)
              service_options: {
                curbside_pickup: place.curbsidePickup,
                delivery: place.delivery,
                dine_in: place.dineIn,
                reservable: place.reservable,
                takeout: place.takeout,
              },
              
              // Accessibility
              accessibility: {
                wheelchair_accessible_entrance: place.accessibilityOptions?.wheelchairAccessibleEntrance,
              },
              
              // Additional attributes
              serves_breakfast: place.servesBreakfast,
              serves_brunch: place.servesBrunch,
              serves_lunch: place.servesLunch,
              serves_dinner: place.servesDinner,
              serves_beer: place.servesBeer,
              serves_wine: place.servesWine,
              serves_vegetarian_food: place.servesVegetarianFood,
              
              // Metadata
              fetched_at: new Date().toISOString(),
              api_version: 'places_v1_new',
              data_completeness: {
                has_photos: (place.photos?.length || 0) > 0,
                has_reviews: (place.reviews?.length || 0) > 0,
                has_hours: !!(place.regularOpeningHours?.periods),
                has_website: !!place.websiteUri,
                has_phone: !!(place.nationalPhoneNumber || place.internationalPhoneNumber),
                has_description: !!place.editorialSummary?.text,
              },
            };
            
            // Insert clinic with all data
            const { data: newClinic, error: insertError } = await supabase
              .from('clinics')
              .insert({
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
                city_id: actualCityId,
                area_id: areaId || null,
                source: 'gmb',
                claim_status: 'unclaimed',
                verification_status: 'unverified',
                is_active: true,
                description: description || null,
                cover_image_url: coverImageUrl,
                gmb_data: gmbData,
              })
              .select()
              .single();
            
            if (insertError) {
              console.error(`Insert error for ${placeName}:`, insertError);
              errors.push(`Failed to insert ${placeName}: ${insertError.message}`);
              continue;
            }
            
            console.log(`Successfully imported: ${placeName} (${newClinic.id})`);
            imported.push(actualPlaceId);
            
            // Insert clinic hours into clinic_hours table
            if (businessHours.length > 0) {
              const hoursInserts = businessHours.map(h => ({
                clinic_id: newClinic.id,
                day_of_week: h.day_of_week,
                open_time: h.open_time,
                close_time: h.close_time,
                is_closed: h.is_closed,
              }));
              
              const { error: hoursError } = await supabase
                .from('clinic_hours')
                .insert(hoursInserts);
              
              if (hoursError) {
                console.error(`Failed to insert hours for ${placeName}:`, hoursError);
              } else {
                console.log(`Inserted business hours for ${placeName}`);
              }
            }
            
            // Insert ALL images into clinic_images table
            if (photoUrls.length > 0) {
              const imageInserts = photoUrls.map((url, index) => ({
                clinic_id: newClinic.id,
                image_url: url,
                display_order: index,
                caption: index === 0 ? 'Main Photo' : `Photo ${index + 1}`,
              }));
              
              const { error: imagesError } = await supabase
                .from('clinic_images')
                .insert(imageInserts);
                
              if (imagesError) {
                console.error(`Failed to insert images for ${placeName}:`, imagesError);
              } else {
                console.log(`Inserted ${imageInserts.length} images for ${placeName}`);
              }
            }
            
            // Store Google reviews if available (new format)
            if (place.reviews && place.reviews.length > 0) {
              const reviewInserts = place.reviews.map((r) => ({
                clinic_id: newClinic.id,
                author_name: r.authorAttribution?.displayName || 'Anonymous',
                author_photo_url: r.authorAttribution?.photoUri,
                rating: r.rating,
                text_content: r.text?.text || r.originalText?.text || '',
                review_time: r.publishTime || null,
                google_review_id: `gmb_${actualPlaceId}_${r.name}`,
                synced_at: new Date().toISOString(),
              }));
              
              const { error: reviewsError } = await supabase
                .from('google_reviews')
                .insert(reviewInserts);
              
              if (reviewsError) {
                console.error(`Failed to insert reviews for ${placeName}:`, reviewsError);
              } else {
                console.log(`Inserted ${reviewInserts.length} reviews for ${placeName}`);
              }
            }
            
            // Log to audit
            await supabase.from('audit_logs').insert({
              action: 'GMB_IMPORT',
              entity_type: 'clinic',
              entity_id: newClinic.id,
              user_id: user.id,
              user_email: user.email,
              new_values: { 
                name: placeName, 
                source: 'gmb', 
                google_place_id: actualPlaceId,
                rating: place.rating,
                review_count: place.userRatingCount,
                photos_count: photoUrls.length,
                hours_synced: businessHours.filter(h => !h.is_closed).length,
                reviews_synced: place.reviews?.length || 0,
                api_version: 'places_v1_new',
              },
            });
            
          } catch (err: unknown) {
            console.error(`Error importing ${placeId}:`, err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            errors.push(`Error importing ${placeId}: ${errorMessage}`);
          }
        }
        
        // Log import batch
        try {
          await supabase.from('gmb_imports').insert({
            search_query: `Batch import of ${placeIds.length} places`,
            total_found: placeIds.length,
            imported_count: imported.length,
            duplicate_count: duplicates.length,
            status: 'completed',
            completed_at: new Date().toISOString(),
            error_log: errors.length > 0 ? { errors } : null,
          });
        } catch (logErr) {
          console.error('Failed to log import batch:', logErr);
        }
        
        console.log(`Import complete: ${imported.length} imported, ${duplicates.length} duplicates, ${errors.length} errors`);
        
        return new Response(
          JSON.stringify({
            success: true,
            imported: imported.length,
            duplicates: duplicates.length,
            imported_place_ids: imported,
            duplicate_place_ids: duplicates,
            errors,
            message: `Successfully imported ${imported.length} clinics with all photos, hours, and reviews.`,
            api_version: 'places_v1_new',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check-duplicates': {
        const { phone } = params;
        
        let query = supabase.from('clinics').select('id, name, phone, address, google_place_id');
        
        const conditions: string[] = [];
        if (phone) {
          const normalizedPhone = phone.replace(/\D/g, '').slice(-9);
          conditions.push(`phone.ilike.%${normalizedPhone}%`);
        }
        
        if (conditions.length === 0) {
          return new Response(
            JSON.stringify({ success: true, duplicates: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: potentialDuplicates } = await query.or(conditions.join(','));
        
        return new Response(
          JSON.stringify({
            success: true,
            duplicates: potentialDuplicates || [],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync': {
        const { placeId, clinicId } = params;
        
        console.log(`[GMB Sync] Starting sync for clinic ${clinicId}, place ${placeId}`);
        
        // Get clinic to verify it matches
        const { data: clinic, error: clinicError } = await supabase
          .from('clinics')
          .select('id, name, google_place_id')
          .eq('id', clinicId)
          .eq('google_place_id', placeId)
          .single();
        
        if (clinicError || !clinic) {
          return new Response(
            JSON.stringify({ success: false, error: 'Clinic not found or place ID mismatch' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch fresh data from Google Places API
        const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
        
        const detailsResponse = await fetch(`https://places.googleapis.com/v1/${resourceName}`, {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': googleApiKey,
            'X-Goog-FieldMask': [
              'id',
              'displayName',
              'formattedAddress',
              'nationalPhoneNumber',
              'internationalPhoneNumber',
              'websiteUri',
              'googleMapsUri',
              'location',
              'rating',
              'userRatingCount',
              'regularOpeningHours',
              'currentOpeningHours',
              'editorialSummary',
              'photos',
            ].join(','),
          },
        });

        if (!detailsResponse.ok) {
          const errorData = await detailsResponse.json();
          console.error('[GMB Sync] Google API error:', errorData);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to fetch from Google', details: errorData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const place = await detailsResponse.json();
        
        // Extract data
        const placeName = place.displayName?.text || clinic.name;
        const address = place.formattedAddress;
        const phone = place.nationalPhoneNumber || place.internationalPhoneNumber;
        const website = place.websiteUri;
        const rating = place.rating;
        const reviewCount = place.userRatingCount;
        const description = place.editorialSummary?.text;

        // Process business hours
        const businessHours = processOpeningHours(place.regularOpeningHours || place.currentOpeningHours);

        // Update clinic with fresh data
        const { error: updateError } = await supabase
          .from('clinics')
          .update({
            name: placeName,
            address,
            phone,
            website,
            rating,
            review_count: reviewCount,
            description: description || null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', clinicId);

        if (updateError) {
          console.error('[GMB Sync] Update error:', updateError);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to update clinic' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Sync business hours
        if (businessHours.length > 0) {
          // Delete existing hours
          await supabase.from('clinic_hours').delete().eq('clinic_id', clinicId);
          
          // Insert new hours
          const hoursInserts = businessHours.map(h => ({
            clinic_id: clinicId,
            day_of_week: h.day_of_week,
            open_time: h.open_time,
            close_time: h.close_time,
            is_closed: h.is_closed,
          }));
          
          const { error: hoursError } = await supabase
            .from('clinic_hours')
            .insert(hoursInserts);
          
          if (hoursError) {
            console.error('[GMB Sync] Hours update error:', hoursError);
          }
        }

        // Sync photos if available
        if (place.photos && place.photos.length > 0) {
          // Get first 5 photo names
          const photoNames = place.photos.slice(0, 5).map((p: any) => p.name);
          
          // Build photo URLs using Google Photo API
          const photoUrls: string[] = [];
          for (const photoName of photoNames) {
            const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${googleApiKey}`;
            photoUrls.push(photoUrl);
          }

          // Update clinic cover image
          if (photoUrls.length > 0) {
            await supabase
              .from('clinics')
              .update({ cover_image_url: photoUrls[0] })
              .eq('id', clinicId);
          }
        }

        console.log(`[GMB Sync] Successfully synced clinic ${clinicId}`);
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Profile synced successfully',
            synced_fields: {
              name: placeName,
              address,
              phone,
              website,
              rating,
              review_count: reviewCount,
              description: description || null,
              hours_count: businessHours.length,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('GMB Import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
