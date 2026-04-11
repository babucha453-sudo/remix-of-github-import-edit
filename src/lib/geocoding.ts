import { supabase } from "@/integrations/supabase/client";

interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

// Free geocoding APIs to use (in order of preference)
const GEOCODING_APIS = [
  // Nominatim (OpenStreetMap) - Free, no API key required
  async (address: string): Promise<GeocodingResult | null> => {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'AppointPanda/1.0'
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name
      };
    }
    return null;
  },
  
  // LocationIQ - Free tier available
  async (address: string): Promise<GeocodingResult | null> => {
    const apiKey = process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;
    if (!apiKey) return null;
    
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://us1.locationiq.com/v1/search?key=${apiKey}&q=${encodedAddress}&format=json&limit=1`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name
      };
    }
    return null;
  },
  
  // Google Maps (if API key available)
  async (address: string): Promise<GeocodingResult | null> => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey) return null;
    
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address
      };
    }
    return null;
  }
];

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address || address.length < 5) return null;
  
  // Try each geocoding API until one works
  for (const geocodeFn of GEOCODING_APIS) {
    try {
      const result = await geocodeFn(address);
      if (result) {
        console.log(`[Geocoding] Successfully geocoded: ${address} -> ${result.latitude}, ${result.longitude}`);
        return result;
      }
    } catch (error) {
      console.log(`[Geocoding] API failed, trying next...`);
      continue;
    }
  }
  
  console.log(`[Geocoding] All APIs failed for: ${address}`);
  return null;
}

// Batch geocode multiple clinics that are missing coordinates
export async function geocodeClinicsWithoutCoordinates(
  limit: number = 50,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  // Get clinics without coordinates
  const { data: clinics, error } = await supabase
    .from('clinics')
    .select('id, name, address, city_id')
    .is('latitude', null)
    .is('longitude', null)
    .eq('is_active', true)
    .limit(limit);
  
  if (error || !clinics || clinics.length === 0) {
    console.log('[Geocoding] No clinics found without coordinates');
    return { success: 0, failed: 0 };
  }
  
  console.log(`[Geocoding] Found ${clinics.length} clinics without coordinates`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < clinics.length; i++) {
    const clinic = clinics[i];
    onProgress?.(i + 1, clinics.length);
    
    // Build address string
    const address = clinic.address || `Clinic ${clinic.name}`;
    
    // Try to geocode
    const result = await geocodeAddress(address);
    
    if (result) {
      // Update clinic with coordinates
      const { error: updateError } = await supabase
        .from('clinics')
        .update({
          latitude: result.latitude,
          longitude: result.longitude
        })
        .eq('id', clinic.id);
      
      if (!updateError) {
        success++;
        console.log(`[Geocoding] Updated clinic ${clinic.name} with coordinates`);
      } else {
        failed++;
      }
    } else {
      failed++;
    }
    
    // Rate limiting - wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`[Geocoding] Complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

// Get clinics with coordinates for map display
export async function getClinicsWithCoordinates(
  cityId?: string,
  stateId?: string,
  limit: number = 100
): Promise<any[]> {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .eq('is_active', true)
    .limit(limit);
  
  if (error) {
    console.error('[Geocoding] Error fetching clinics with coordinates:', error);
    return [];
  }
  
  let results = data || [];
  
  if (cityId) {
    results = results.filter((c: any) => c.city_id === cityId);
  }
  
  if (stateId && !cityId) {
    results = results.filter((c: any) => (c as any).state_id === stateId);
  }
  
  return results.slice(0, limit);
}

// Check if coordinates exist in database
export async function checkCoordinateStats(): Promise<{
  withCoords: number;
  withoutCoords: number;
  total: number;
}> {
  const { count: total } = await supabase
    .from('clinics')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  
  const { count: withCoords } = await supabase
    .from('clinics')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  
  return {
    total: total || 0,
    withCoords: withCoords || 0,
    withoutCoords: (total || 0) - (withCoords || 0)
  };
}