import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, MapPin, Zap, CheckCircle, AlertCircle, Database } from "lucide-react";

interface CoordinateStats {
  withCoords: number;
  withoutCoords: number;
  total: number;
}

// US city coordinates lookup (major cities only — for full coverage use a geocoding API)
const getCityCoordinates = (cityName: string | null): { lat: number; lng: number } | null => {
  if (!cityName) return null;
  
  const cities: Record<string, { lat: number; lng: number }> = {
    'new york': { lat: 40.7128, lng: -74.0060 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    'chicago': { lat: 41.8781, lng: -87.6298 },
    'houston': { lat: 29.7604, lng: -95.3698 },
    'phoenix': { lat: 33.4484, lng: -112.0740 },
    'philadelphia': { lat: 39.9526, lng: -75.1652 },
    'san antonio': { lat: 29.4241, lng: -98.4936 },
    'san diego': { lat: 32.7157, lng: -117.1611 },
    'dallas': { lat: 32.7767, lng: -96.7970 },
    'san jose': { lat: 37.3382, lng: -121.8863 },
    'austin': { lat: 30.2672, lng: -97.7431 },
    'jacksonville': { lat: 30.3322, lng: -81.6557 },
    'fort worth': { lat: 32.7555, lng: -97.3308 },
    'columbus': { lat: 39.9612, lng: -82.9988 },
    'charlotte': { lat: 35.2271, lng: -80.8431 },
    'indianapolis': { lat: 39.7684, lng: -86.1581 },
    'san francisco': { lat: 37.7749, lng: -122.4194 },
    'seattle': { lat: 47.6062, lng: -122.3321 },
    'denver': { lat: 39.7392, lng: -104.9903 },
    'nashville': { lat: 36.1627, lng: -86.7816 },
    'oklahoma city': { lat: 35.4676, lng: -97.5164 },
    'el paso': { lat: 31.7619, lng: -106.4850 },
    'washington': { lat: 38.9072, lng: -77.0369 },
    'boston': { lat: 42.3601, lng: -71.0589 },
    'las vegas': { lat: 36.1699, lng: -115.1398 },
    'portland': { lat: 45.5152, lng: -122.6784 },
    'memphis': { lat: 35.1495, lng: -90.0490 },
    'louisville': { lat: 38.2527, lng: -85.7585 },
    'baltimore': { lat: 39.2904, lng: -76.6122 },
    'milwaukee': { lat: 43.0389, lng: -87.9065 },
    'albuquerque': { lat: 35.0853, lng: -106.6056 },
    'tucson': { lat: 32.2226, lng: -110.9747 },
    'fresno': { lat: 36.7378, lng: -119.7871 },
    'sacramento': { lat: 38.5816, lng: -121.4944 },
    'miami': { lat: 25.7617, lng: -80.1918 },
    'kansas city': { lat: 39.0997, lng: -94.5786 },
    'atlanta': { lat: 33.7490, lng: -84.3880 },
    'omaha': { lat: 41.2565, lng: -95.9345 },
    'colorado springs': { lat: 38.8339, lng: -104.8214 },
    'raleigh': { lat: 35.7796, lng: -78.6382 },
    'long beach': { lat: 33.7701, lng: -118.1937 },
    'virginia beach': { lat: 36.8529, lng: -75.9780 },
    'oakland': { lat: 37.8044, lng: -122.2712 },
    'minneapolis': { lat: 44.9778, lng: -93.2650 },
    'tampa': { lat: 27.9506, lng: -82.4572 },
    'tulsa': { lat: 36.1540, lng: -95.9928 },
    'arlington': { lat: 32.7357, lng: -97.1081 },
    'new orleans': { lat: 29.9511, lng: -90.0715 },
    'cleveland': { lat: 41.4993, lng: -81.6944 },
    'bakersfield': { lat: 35.3733, lng: -119.0187 },
  };

  const name = cityName.toLowerCase().trim();
  return cities[name] || null;
};

export function GeocodingTool() {
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  // Get coordinate stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['coordinate-stats'],
    queryFn: async (): Promise<CoordinateStats> => {
      // Get all active clinics
      const { data: allClinics } = await supabase
        .from('clinics')
        .select('id, latitude')
        .eq('is_active', true);

      const total = allClinics?.length || 0;
      const withCoords = allClinics?.filter(c => c.latitude !== null)?.length || 0;
      
      return {
        total,
        withCoords,
        withoutCoords: total - withCoords
      };
    }
  });

  // Main function: assign coordinates by city
  const assignCoordinates = async () => {
    setIsGeocoding(true);
    setResult(null);
    setProgress({ current: 0, total: 0, status: 'Fetching clinics...' });

    try {
      // Get all clinics with their city info - no join needed, just get city_id
      const { data: clinics, error } = await supabase
        .from('clinics')
        .select('id, city_id, latitude')
        .eq('is_active', true)
        .is('latitude', null);

      if (error) {
        console.error('Error:', error);
        setProgress({ current: 0, total: 0, status: 'Error: ' + error.message });
        setIsGeocoding(false);
        return;
      }

      if (!clinics || clinics.length === 0) {
        setProgress({ current: 0, total: 0, status: 'No clinics need coordinates!' });
        setIsGeocoding(false);
        return;
      }

      // Get all cities to map city_id to city name
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name');

      const cityMap = new Map((cities || []).map(c => [c.id, c.name]));

      setProgress({ current: 0, total: clinics.length, status: `Processing ${clinics.length} clinics...` });

      let success = 0;
      let failed = 0;

      // Update each clinic
      for (let i = 0; i < clinics.length; i++) {
        const clinic = clinics[i];
        const cityName = clinic.city_id ? cityMap.get(clinic.city_id) : null;
        const coords = getCityCoordinates(cityName);

        if (coords) {
          await supabase
            .from('clinics')
            .update({ 
              latitude: coords.lat, 
              longitude: coords.lng 
            })
            .eq('id', clinic.id);
          success++;
        } else {
          failed++;
        }

        setProgress({ 
          current: i + 1, 
          total: clinics.length, 
          status: `Processing ${i + 1}/${clinics.length}` 
        });

        // Small delay every 10 clinics
        if (i % 10 === 0) {
          await new Promise(r => setTimeout(r, 50));
        }
      }

      setResult({ success, failed });
      setProgress({ current: 0, total: 0, status: 'Complete!' });
      refetchStats();
    } catch (err) {
      console.error('Error:', err);
      setProgress({ current: 0, total: 0, status: 'Error occurred' });
    } finally {
      setIsGeocoding(false);
    }
  };

  const percentage = stats ? Math.round((stats.withCoords / (stats.total || 1)) * 100) : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-emerald-600" />
          Map Coordinates
        </CardTitle>
        <CardDescription>
          Add coordinates to clinics based on city
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>With coordinates:</span>
            <span className="font-semibold">{stats?.withCoords || 0} / {stats?.total || 0}</span>
          </div>
          <Progress value={percentage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Need coordinates: {stats?.withoutCoords || 0}
          </p>
        </div>

        {/* Progress */}
        {isGeocoding && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="truncate">{progress.status}</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
            <Progress value={(progress.current / (progress.total || 1)) * 100} />
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-3 rounded-lg ${result.success > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-2">
              {result.success > 0 ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm">
                Success: {result.success} | Failed: {result.failed}
              </span>
            </div>
          </div>
        )}

        {/* Button */}
        <Button 
          onClick={assignCoordinates} 
          disabled={isGeocoding || !stats?.withoutCoords}
          className="w-full"
        >
          {isGeocoding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Add Coordinates by City
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}