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

// Simple UAE city coordinates lookup
const getCityCoordinates = (cityName: string | null): { lat: number; lng: number } | null => {
  if (!cityName) return null;
  
  const cities: Record<string, { lat: number; lng: number }> = {
    'dubai': { lat: 25.2048, lng: 55.2708 },
    'abu dhabi': { lat: 24.4539, lng: 54.3773 },
    'sharjah': { lat: 25.3463, lng: 55.4209 },
    'al ain': { lat: 24.2075, lng: 55.7447 },
    'ajman': { lat: 25.4052, lng: 55.5136 },
    'ras al khaimah': { lat: 25.7895, lng: 55.9432 },
    'fujairah': { lat: 25.1288, lng: 56.3265 },
    'umm al quwain': { lat: 25.5647, lng: 55.5553 },
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