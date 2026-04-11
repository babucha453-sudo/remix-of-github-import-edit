import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// US City coordinates database - major cities for CA, MA, CT
// These are approximate center coordinates for each city
const US_CITY_COORDINATES: Record<string, Record<string, { lat: number; lng: number }>> = {
  "California": {
    "Los Angeles": { lat: 34.0522, lng: -118.2437 },
    "San Diego": { lat: 32.7157, lng: -117.1611 },
    "San Jose": { lat: 37.3382, lng: -121.8863 },
    "San Francisco": { lat: 37.7749, lng: -122.4194 },
    "Fresno": { lat: 36.7378, lng: -119.7871 },
    "Sacramento": { lat: 38.5816, lng: -121.4944 },
    "Long Beach": { lat: 33.7701, lng: -118.1937 },
    "Oakland": { lat: 37.8044, lng: -122.2712 },
    "Bakersfield": { lat: 35.3733, lng: -119.0187 },
    "Anaheim": { lat: 33.8366, lng: -117.9143 },
    "Santa Ana": { lat: 33.7455, lng: -117.8677 },
    "Riverside": { lat: 33.9533, lng: -117.3962 },
    "Stockton": { lat: 37.9577, lng: -121.2908 },
    "Irvine": { lat: 33.6846, lng: -117.8265 },
    "Chula Vista": { lat: 32.6401, lng: -117.0842 },
    "Fremont": { lat: 37.5485, lng: -121.9886 },
    "San Bernardino": { lat: 34.1083, lng: -117.2898 },
    "Modesto": { lat: 37.6391, lng: -120.9969 },
    "Fontana": { lat: 34.0922, lng: -117.4350 },
    "Moreno Valley": { lat: 33.9425, lng: -117.2297 },
    "Glendale": { lat: 34.1425, lng: -118.2551 },
    "Huntington Beach": { lat: 33.6595, lng: -117.9988 },
    "Santa Clarita": { lat: 34.3917, lng: -118.5426 },
    "Garden Grove": { lat: 33.7743, lng: -117.9380 },
    "Oceanside": { lat: 33.1959, lng: -117.3795 },
    "Rancho Cucamonga": { lat: 34.1064, lng: -117.5931 },
    "Ontario": { lat: 34.0633, lng: -117.6509 },
    "Santa Rosa": { lat: 38.4405, lng: -122.7141 },
    "Elk Grove": { lat: 38.4088, lng: -121.3716 },
    "Corona": { lat: 33.8753, lng: -117.5664 },
    "Lancaster": { lat: 34.6868, lng: -118.1542 },
    "Palmdale": { lat: 34.5794, lng: -118.1165 },
    "Salinas": { lat: 36.6777, lng: -121.6555 },
    "Pomona": { lat: 34.0551, lng: -117.7500 },
    "Hayward": { lat: 37.6688, lng: -122.0808 },
    "Escondido": { lat: 33.1192, lng: -117.0864 },
    "Sunnyvale": { lat: 37.3688, lng: -122.0363 },
    "Torrance": { lat: 33.8358, lng: -118.3406 },
    "Pasadena": { lat: 34.1478, lng: -118.1445 },
    "Orange": { lat: 33.7879, lng: -117.8531 },
    "Fullerton": { lat: 33.8704, lng: -117.9242 },
    "Thousand Oaks": { lat: 34.1706, lng: -118.8376 },
    "Roseville": { lat: 38.7521, lng: -121.2880 },
    "Concord": { lat: 37.9780, lng: -122.0311 },
    "Simi Valley": { lat: 34.2694, lng: -118.7815 },
    "Santa Clara": { lat: 37.3541, lng: -121.9552 },
    "Victorville": { lat: 34.5362, lng: -117.2928 },
    "Vallejo": { lat: 38.1041, lng: -122.2566 },
    "Berkeley": { lat: 37.8716, lng: -122.2727 },
    "El Monte": { lat: 34.0686, lng: -118.0276 },
    "Downey": { lat: 33.9401, lng: -118.1332 },
    "Costa Mesa": { lat: 33.6412, lng: -117.9187 },
    "Inglewood": { lat: 33.9617, lng: -118.3531 },
    "Carlsbad": { lat: 33.1581, lng: -117.3506 },
    "San Buenaventura": { lat: 34.2746, lng: -119.2290 },
    "Fairfield": { lat: 38.2494, lng: -122.0400 },
    "West Covina": { lat: 34.0686, lng: -117.9390 },
    "Murrieta": { lat: 33.5539, lng: -117.2139 },
    "Richmond": { lat: 37.9358, lng: -122.3477 },
    "Norwalk": { lat: 33.9022, lng: -118.0817 },
    "Antioch": { lat: 38.0049, lng: -121.8058 },
    "Temecula": { lat: 33.4936, lng: -117.1484 },
    "Burbank": { lat: 34.1808, lng: -118.3090 },
    "Daly City": { lat: 37.6879, lng: -122.4702 },
    "El Cajon": { lat: 32.7948, lng: -116.9625 },
    "San Mateo": { lat: 37.5630, lng: -122.3255 },
    "Clovis": { lat: 36.8252, lng: -119.7029 },
    "Compton": { lat: 33.8958, lng: -118.2201 },
    "Rialto": { lat: 34.1064, lng: -117.3703 },
    "Vista": { lat: 33.2000, lng: -117.2425 },
    "South Gate": { lat: 33.9547, lng: -118.2120 },
    "Mission Viejo": { lat: 33.5965, lng: -117.6590 },
    "Vacaville": { lat: 38.3566, lng: -121.9877 },
    "Carson": { lat: 33.8314, lng: -118.2820 },
    "Hesperia": { lat: 34.4264, lng: -117.3009 },
    "Santa Maria": { lat: 34.9530, lng: -120.4357 },
    "Redding": { lat: 40.5865, lng: -122.3917 },
    "Westminster": { lat: 33.7513, lng: -117.9940 },
    "Santa Monica": { lat: 34.0195, lng: -118.4912 },
    "Chico": { lat: 39.7285, lng: -121.8375 },
    "Newport Beach": { lat: 33.6189, lng: -117.9289 },
    "San Leandro": { lat: 37.7249, lng: -122.1561 },
    "San Marcos": { lat: 33.1434, lng: -117.1661 },
    "Whittier": { lat: 33.9792, lng: -118.0328 },
    "Hawthorne": { lat: 33.9164, lng: -118.3526 },
    "Citrus Heights": { lat: 38.7071, lng: -121.2811 },
    "Alhambra": { lat: 34.0953, lng: -118.1270 },
    "Tracy": { lat: 37.7397, lng: -121.4252 },
    "Livermore": { lat: 37.6819, lng: -121.7680 },
    "Buena Park": { lat: 33.8675, lng: -117.9981 },
    "Menifee": { lat: 33.6971, lng: -117.1850 },
    "Hemet": { lat: 33.7476, lng: -116.9719 },
    "Lakewood": { lat: 33.8536, lng: -118.1340 },
    "Merced": { lat: 37.3022, lng: -120.4830 },
    "Chino": { lat: 34.0122, lng: -117.6889 },
    "Indio": { lat: 33.7206, lng: -116.2156 },
    "Redwood City": { lat: 37.4852, lng: -122.2364 },
    "Lake Forest": { lat: 33.6470, lng: -117.6892 },
    "Napa": { lat: 38.2975, lng: -122.2869 },
    "Tustin": { lat: 33.7458, lng: -117.8262 },
    "Bellflower": { lat: 33.8817, lng: -118.1170 },
    "Mountain View": { lat: 37.3861, lng: -122.0839 },
    "Chino Hills": { lat: 33.9898, lng: -117.7326 },
    "Baldwin Park": { lat: 34.0853, lng: -117.9609 },
    "Alameda": { lat: 37.7652, lng: -122.2416 },
    "Upland": { lat: 34.0975, lng: -117.6484 },
    "San Ramon": { lat: 37.7799, lng: -121.9780 },
    "Folsom": { lat: 38.6780, lng: -121.1761 },
    "Pleasanton": { lat: 37.6624, lng: -121.8747 },
    "Lynwood": { lat: 33.9303, lng: -118.2115 },
    "Beverly Hills": { lat: 34.0736, lng: -118.4004 },
    "Oxnard": { lat: 34.1975, lng: -119.1771 },
    "Visalia": { lat: 36.3302, lng: -119.2921 },
    "Ventura": { lat: 34.2746, lng: -119.2290 },
  },
  "Massachusetts": {
    "Boston": { lat: 42.3601, lng: -71.0589 },
    "Worcester": { lat: 42.2626, lng: -71.8023 },
    "Springfield": { lat: 42.1015, lng: -72.5898 },
    "Cambridge": { lat: 42.3736, lng: -71.1097 },
    "Lowell": { lat: 42.6334, lng: -71.3162 },
    "Brockton": { lat: 42.0834, lng: -71.0184 },
    "New Bedford": { lat: 41.6362, lng: -70.9342 },
    "Quincy": { lat: 42.2529, lng: -71.0023 },
    "Lynn": { lat: 42.4668, lng: -70.9495 },
    "Fall River": { lat: 41.7015, lng: -71.1550 },
    "Newton": { lat: 42.3370, lng: -71.2092 },
    "Lawrence": { lat: 42.7070, lng: -71.1631 },
    "Somerville": { lat: 42.3876, lng: -71.0995 },
    "Framingham": { lat: 42.2793, lng: -71.4162 },
    "Haverhill": { lat: 42.7762, lng: -71.0773 },
    "Waltham": { lat: 42.3765, lng: -71.2356 },
    "Malden": { lat: 42.4251, lng: -71.0662 },
    "Brookline": { lat: 42.3318, lng: -71.1212 },
    "Plymouth": { lat: 41.9584, lng: -70.6673 },
    "Medford": { lat: 42.4184, lng: -71.1062 },
    "Taunton": { lat: 41.9001, lng: -71.0898 },
    "Chicopee": { lat: 42.1487, lng: -72.6079 },
    "Weymouth": { lat: 42.2211, lng: -70.9395 },
    "Revere": { lat: 42.4084, lng: -71.0120 },
    "Peabody": { lat: 42.5279, lng: -70.9287 },
    "Methuen": { lat: 42.7262, lng: -71.1909 },
    "Barnstable": { lat: 41.7003, lng: -70.3002 },
    "Pittsfield": { lat: 42.4501, lng: -73.2454 },
    "Attleboro": { lat: 41.9445, lng: -71.2856 },
    "Everett": { lat: 42.4084, lng: -71.0537 },
    "Salem": { lat: 42.5195, lng: -70.8967 },
    "Westfield": { lat: 42.1251, lng: -72.7495 },
    "Leominster": { lat: 42.5251, lng: -71.7598 },
    "Fitchburg": { lat: 42.5834, lng: -71.8023 },
    "Beverly": { lat: 42.5584, lng: -70.8800 },
    "Holyoke": { lat: 42.2043, lng: -72.6162 },
    "Marlborough": { lat: 42.3459, lng: -71.5523 },
    "Woburn": { lat: 42.4793, lng: -71.1523 },
    "Chelsea": { lat: 42.3918, lng: -71.0328 },
    "Braintree": { lat: 42.2038, lng: -71.0023 },
    "Natick": { lat: 42.2834, lng: -71.3498 },
    "Chelmsford": { lat: 42.5998, lng: -71.3673 },
    "Billerica": { lat: 42.5584, lng: -71.2689 },
    "Reading": { lat: 42.5256, lng: -71.0953 },
    "Andover": { lat: 42.6584, lng: -71.1370 },
    "Needham": { lat: 42.2793, lng: -71.2356 },
    "Lexington": { lat: 42.4473, lng: -71.2245 },
    "Arlington": { lat: 42.4154, lng: -71.1565 },
    "Northampton": { lat: 42.3251, lng: -72.6412 },
    "Amherst": { lat: 42.3732, lng: -72.5199 },
    "Wellesley": { lat: 42.2965, lng: -71.2923 },
    "Watertown": { lat: 42.3709, lng: -71.1828 },
    "Dedham": { lat: 42.2418, lng: -71.1662 },
    "Milton": { lat: 42.2501, lng: -71.0662 },
  },
  "Connecticut": {
    "Bridgeport": { lat: 41.1865, lng: -73.1952 },
    "New Haven": { lat: 41.3083, lng: -72.9279 },
    "Stamford": { lat: 41.0534, lng: -73.5387 },
    "Hartford": { lat: 41.7658, lng: -72.6734 },
    "Waterbury": { lat: 41.5582, lng: -73.0515 },
    "Norwalk": { lat: 41.1177, lng: -73.4082 },
    "Danbury": { lat: 41.3948, lng: -73.4540 },
    "New Britain": { lat: 41.6612, lng: -72.7795 },
    "West Hartford": { lat: 41.7621, lng: -72.7420 },
    "Greenwich": { lat: 41.0262, lng: -73.6282 },
    "Fairfield": { lat: 41.1412, lng: -73.2637 },
    "Hamden": { lat: 41.3959, lng: -72.8968 },
    "Bristol": { lat: 41.6718, lng: -72.9493 },
    "Meriden": { lat: 41.5382, lng: -72.8070 },
    "Manchester": { lat: 41.7759, lng: -72.5215 },
    "West Haven": { lat: 41.2712, lng: -72.9470 },
    "Milford": { lat: 41.2223, lng: -73.0565 },
    "Stratford": { lat: 41.1845, lng: -73.1332 },
    "East Hartford": { lat: 41.7823, lng: -72.6176 },
    "Middletown": { lat: 41.5623, lng: -72.6507 },
    "Wallingford": { lat: 41.4570, lng: -72.8231 },
    "Enfield": { lat: 41.9762, lng: -72.5918 },
    "Southington": { lat: 41.5959, lng: -72.8770 },
    "Shelton": { lat: 41.3165, lng: -73.0932 },
    "Norwich": { lat: 41.5240, lng: -72.0759 },
    "Trumbull": { lat: 41.2429, lng: -73.2007 },
    "Torrington": { lat: 41.8006, lng: -73.1212 },
    "Glastonbury": { lat: 41.7123, lng: -72.6082 },
    "Naugatuck": { lat: 41.4859, lng: -73.0507 },
    "Newington": { lat: 41.6979, lng: -72.7237 },
    "Vernon": { lat: 41.8362, lng: -72.4568 },
    "Cheshire": { lat: 41.4990, lng: -72.9007 },
    "Windsor": { lat: 41.8523, lng: -72.6437 },
    "Groton": { lat: 41.3501, lng: -72.0784 },
    "New London": { lat: 41.3557, lng: -72.0995 },
    // Additional CT cities that were missing
    "Ansonia": { lat: 41.3462, lng: -73.0787 },
    "Cromwell": { lat: 41.5951, lng: -72.6454 },
    "Derby": { lat: 41.3207, lng: -73.0890 },
    "Rocky Hill": { lat: 41.6640, lng: -72.6393 },
    "Wethersfield": { lat: 41.7143, lng: -72.6523 },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, stateId } = await req.json();

    if (action === "geocode-cities") {
      // Add coordinates to all cities that don't have them
      const { data: cities, error: citiesError } = await supabase
        .from("cities")
        .select("id, name, state:states(name)")
        .is("latitude", null)
        .eq("is_active", true);

      if (citiesError) throw citiesError;

      let updated = 0;
      let notFound = 0;
      const notFoundCities: string[] = [];

      for (const city of cities || []) {
        const stateData = city.state as unknown as { name: string } | null;
        const stateName = stateData?.name;
        if (!stateName || !US_CITY_COORDINATES[stateName]) continue;

        const coords = US_CITY_COORDINATES[stateName][city.name];
        if (coords) {
          await supabase
            .from("cities")
            .update({ latitude: coords.lat, longitude: coords.lng })
            .eq("id", city.id);
          updated++;
        } else {
          notFound++;
          notFoundCities.push(`${city.name}, ${stateName}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated,
          notFound,
          notFoundCities: notFoundCities.slice(0, 20),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "redistribute-clinics") {
      // Helper function to fetch all rows with pagination
      const fetchAllRows = async (
        table: string,
        query: string,
        filters: { column: string; op: string; value: any }[] = []
      ) => {
        const allRows: any[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          let q = supabase
            .from(table)
            .select(query)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          for (const filter of filters) {
            if (filter.op === "eq") q = q.eq(filter.column, filter.value);
            else if (filter.op === "not.is.null") q = q.not(filter.column, "is", null);
          }

          const { data, error } = await q;
          if (error) throw error;

          if (data && data.length > 0) {
            allRows.push(...data);
            hasMore = data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }
        return allRows;
      };

      // Get cities with coordinates
      let citiesQuery = supabase
        .from("cities")
        .select("id, name, latitude, longitude, state_id")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .eq("is_active", true);
      
      if (stateId) {
        citiesQuery = citiesQuery.eq("state_id", stateId);
      }

      const { data: cities, error: citiesError } = await citiesQuery;
      if (citiesError) throw citiesError;

      if (!cities || cities.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No cities with coordinates found. Run geocode-cities first.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch ALL clinics with coordinates using pagination
      console.log("Fetching all clinics with pagination...");
      const allClinics: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: clinicBatch, error: clinicsError } = await supabase
          .from("clinics")
          .select("id, name, latitude, longitude, city_id, city:cities(name, state_id)")
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .eq("is_active", true)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (clinicsError) throw clinicsError;

        if (clinicBatch && clinicBatch.length > 0) {
          allClinics.push(...clinicBatch);
          console.log(`Fetched page ${page + 1}: ${clinicBatch.length} clinics (total: ${allClinics.length})`);
          hasMore = clinicBatch.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total clinics fetched: ${allClinics.length}`);

      let reassigned = 0;
      let unchanged = 0;
      const changes: Array<{ clinic: string; from: string; to: string; distance: number }> = [];

      // Haversine distance function
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };

      // Process in batches to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < allClinics.length; i += batchSize) {
        const batch = allClinics.slice(i, i + batchSize);
        
        const updatePromises = batch.map(async (clinic) => {
          const cityData = clinic.city as unknown as { name: string; state_id: string } | null;
          const clinicStateId = cityData?.state_id;
          
          // Find nearest city in same state
          let nearestCity: typeof cities[0] | null = null;
          let minDistance = Infinity;

          for (const city of cities) {
            if (clinicStateId && city.state_id !== clinicStateId) continue;
            
            const distance = haversine(
              Number(clinic.latitude),
              Number(clinic.longitude),
              Number(city.latitude),
              Number(city.longitude)
            );
            
            if (distance < minDistance) {
              minDistance = distance;
              nearestCity = city;
            }
          }

          if (nearestCity && nearestCity.id !== clinic.city_id) {
            await supabase
              .from("clinics")
              .update({ city_id: nearestCity.id, updated_at: new Date().toISOString() })
              .eq("id", clinic.id);
            
            return { 
              reassigned: true, 
              change: changes.length < 100 ? {
                clinic: clinic.name,
                from: cityData?.name || "Unknown",
                to: nearestCity.name,
                distance: Math.round(minDistance * 10) / 10,
              } : null
            };
          } else {
            return { reassigned: false, change: null };
          }
        });

        const results = await Promise.all(updatePromises);
        for (const result of results) {
          if (result.reassigned) {
            reassigned++;
            if (result.change) changes.push(result.change);
          } else {
            unchanged++;
          }
        }
      }

      // Update dentist_count on cities
      try {
        await supabase.rpc("update_city_dentist_counts");
      } catch (e) {
        console.log("update_city_dentist_counts RPC not found, skipping");
      }

      return new Response(
        JSON.stringify({
          success: true,
          reassigned,
          unchanged,
          totalProcessed: allClinics.length,
          sampleChanges: changes.slice(0, 50),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "stats") {
      // Get distribution stats with pagination for accurate counts
      const { count: totalCities } = await supabase
        .from("cities")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: citiesWithCoords } = await supabase
        .from("cities")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      const { count: totalClinics } = await supabase
        .from("clinics")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: clinicsWithCoords } = await supabase
        .from("clinics")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      return new Response(
        JSON.stringify({
          cities: {
            total: totalCities || 0,
            withCoordinates: citiesWithCoords || 0,
            withoutCoordinates: (totalCities || 0) - (citiesWithCoords || 0),
          },
          clinics: {
            total: totalClinics || 0,
            withCoordinates: clinicsWithCoords || 0,
            withoutCoordinates: (totalClinics || 0) - (clinicsWithCoords || 0),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
