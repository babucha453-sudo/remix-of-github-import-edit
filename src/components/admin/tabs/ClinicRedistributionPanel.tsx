import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, Navigation, RefreshCw, CheckCircle, AlertCircle, 
  Building, Globe, ArrowRight, XCircle, ChevronDown, ChevronUp,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RedistributionStats {
  cities: {
    total: number;
    withCoordinates: number;
    withoutCoordinates: number;
    missingList?: Array<{ name: string; state: string; clinicCount: number }>;
  };
  clinics: {
    total: number;
    withCoordinates: number;
    withoutCoordinates: number;
  };
}

interface GeocodeResult {
  success: boolean;
  updated: number;
  notFound: number;
  notFoundCities: string[];
}

interface RedistributeResult {
  success: boolean;
  reassigned: number;
  unchanged: number;
  totalProcessed: number;
  sampleChanges: Array<{
    clinic: string;
    from: string;
    to: string;
    distance: number;
  }>;
}

export default function ClinicRedistributionPanel() {
  const [stats, setStats] = useState<RedistributionStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isRedistributing, setIsRedistributing] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
  const [redistributeResult, setRedistributeResult] = useState<RedistributeResult | null>(null);
  const [showMissingCities, setShowMissingCities] = useState(false);
  const [showChanges, setShowChanges] = useState(false);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      // Fetch from edge function
      const { data, error } = await supabase.functions.invoke('clinic-redistribution', {
        body: { action: 'stats' }
      });
      
      if (error) throw error;
      
      // Also fetch the list of cities missing coordinates with clinic counts
      const { data: missingCities } = await supabase
        .from('cities')
        .select(`
          id,
          name, 
          state:states(name)
        `)
        .eq('is_active', true)
        .or('latitude.is.null,longitude.is.null')
        .order('name');

      // Build list with clinic counts
      const missingCitiesWithCounts: Array<{ name: string; state: string; clinicCount: number }> = [];
      
      for (const city of missingCities || []) {
        const { count } = await supabase
          .from('clinics')
          .select('*', { count: 'exact', head: true })
          .eq('city_id', city.id)
          .eq('is_active', true);
        
        const stateData = city.state as unknown as { name: string } | null;
        missingCitiesWithCounts.push({
          name: city.name,
          state: stateData?.name || 'Unknown',
          clinicCount: count || 0
        });
      }

      setStats({
        cities: {
          ...data.cities,
          missingList: missingCitiesWithCounts
        },
        clinics: data.clinics
      });
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      toast.error('Failed to fetch redistribution stats');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const runGeocoding = async () => {
    setIsGeocoding(true);
    setGeocodeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('clinic-redistribution', {
        body: { action: 'geocode-cities' }
      });
      
      if (error) throw error;
      
      setGeocodeResult(data);
      toast.success(`Geocoded ${data.updated} cities!`);
      fetchStats(); // Refresh stats
    } catch (err: any) {
      toast.error('Geocoding failed: ' + err.message);
    } finally {
      setIsGeocoding(false);
    }
  };

  const runRedistribution = async () => {
    setIsRedistributing(true);
    setRedistributeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('clinic-redistribution', {
        body: { action: 'redistribute-clinics' }
      });
      
      if (error) throw error;
      
      setRedistributeResult(data);
      
      if (data.reassigned > 0) {
        toast.success(`Reassigned ${data.reassigned} clinics to correct cities!`);
      } else {
        toast.info('All clinics are already in their nearest city.');
      }
      
      fetchStats(); // Refresh stats
    } catch (err: any) {
      toast.error('Redistribution failed: ' + err.message);
    } finally {
      setIsRedistributing(false);
    }
  };

  const getCoveragePercentage = () => {
    if (!stats) return 0;
    return Math.round((stats.cities.withCoordinates / stats.cities.total) * 100);
  };

  const getClinicCoveragePercentage = () => {
    if (!stats) return 0;
    return Math.round((stats.clinics.withCoordinates / stats.clinics.total) * 100);
  };

  if (isLoadingStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading redistribution stats...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clinic Redistribution</h2>
          <p className="text-muted-foreground">
            Ensure clinics are assigned to their correct nearest city based on GPS coordinates
          </p>
        </div>
        <Button variant="outline" onClick={fetchStats} disabled={isLoadingStats}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingStats ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </div>

      {/* Coverage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* City Coverage */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                City Coordinate Coverage
              </CardTitle>
              <Badge variant={getCoveragePercentage() === 100 ? 'default' : 'secondary'}>
                {getCoveragePercentage()}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={getCoveragePercentage()} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center p-2 bg-muted rounded-lg">
                <p className="text-xl font-bold">{stats?.cities.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Cities</p>
              </div>
              <div className="text-center p-2 bg-primary/10 rounded-lg">
                <p className="text-xl font-bold text-primary">{stats?.cities.withCoordinates || 0}</p>
                <p className="text-xs text-muted-foreground">With Coords</p>
              </div>
              <div className="text-center p-2 bg-destructive/10 rounded-lg">
                <p className="text-xl font-bold text-destructive">{stats?.cities.withoutCoordinates || 0}</p>
                <p className="text-xs text-muted-foreground">Missing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinic Coverage */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-5 w-5 text-blue-custom" />
                Clinic Coordinate Coverage
              </CardTitle>
              <Badge variant={getClinicCoveragePercentage() >= 95 ? 'default' : 'secondary'}>
                {getClinicCoveragePercentage()}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={getClinicCoveragePercentage()} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center p-2 bg-muted rounded-lg">
                <p className="text-xl font-bold">{stats?.clinics.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Clinics</p>
              </div>
              <div className="text-center p-2 bg-primary/10 rounded-lg">
                <p className="text-xl font-bold text-primary">{stats?.clinics.withCoordinates || 0}</p>
                <p className="text-xs text-muted-foreground">With Coords</p>
              </div>
              <div className="text-center p-2 bg-destructive/10 rounded-lg">
                <p className="text-xl font-bold text-destructive">{stats?.clinics.withoutCoordinates || 0}</p>
                <p className="text-xs text-muted-foreground">Missing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missing Cities List */}
      {stats?.cities.withoutCoordinates > 0 && (
        <Collapsible open={showMissingCities} onOpenChange={setShowMissingCities}>
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    {stats.cities.withoutCoordinates} Cities Missing Coordinates
                  </CardTitle>
                  {showMissingCities ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CardDescription>
                These cities need coordinates added to the system database
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">Clinics</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.cities.missingList?.map((city, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{city.name}</TableCell>
                          <TableCell className="text-muted-foreground">{city.state}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={city.clinicCount > 0 ? 'destructive' : 'secondary'}>
                              {city.clinicCount}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Action Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Redistribution Actions</CardTitle>
          <CardDescription>
            Follow these steps to ensure all clinics are in the correct city
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Geocode */}
          <div className="flex items-start gap-4 p-4 border rounded-xl">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Geocode Cities</h4>
                {geocodeResult && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Updated {geocodeResult.updated}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Add latitude/longitude coordinates to cities using the built-in US city database. 
                This enables distance-based matching.
              </p>
              <Button onClick={runGeocoding} disabled={isGeocoding} size="sm">
                {isGeocoding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Run Geocoding
                  </>
                )}
              </Button>
              
              {/* Geocode Result Details */}
              {geocodeResult && (
                <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span>Updated: <strong>{geocodeResult.updated}</strong> cities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Not in database: <strong>{geocodeResult.notFound}</strong> cities</span>
                    </div>
                  </div>
                  {geocodeResult.notFoundCities?.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Cities not in coordinate database:</p>
                      <p className="line-clamp-2">{geocodeResult.notFoundCities.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Redistribute */}
          <div className="flex items-start gap-4 p-4 border rounded-xl">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Redistribute Clinics</h4>
                {redistributeResult && (
                  <Badge variant={redistributeResult.reassigned > 0 ? 'default' : 'secondary'} className="gap-1">
                    {redistributeResult.reassigned > 0 ? (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        Moved {redistributeResult.reassigned}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        All correct
                      </>
                    )}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Reassign clinics to their nearest city based on GPS coordinates. 
                Only clinics with coordinates will be processed.
              </p>
              <Button 
                onClick={runRedistribution} 
                disabled={isRedistributing || stats?.cities.withCoordinates === 0} 
                size="sm"
              >
                {isRedistributing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    Run Redistribution
                  </>
                )}
              </Button>
              
              {/* Redistribute Result Details */}
              {redistributeResult && (
                <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-background rounded">
                      <p className="text-lg font-bold">{redistributeResult.totalProcessed}</p>
                      <p className="text-xs text-muted-foreground">Processed</p>
                    </div>
                    <div className="text-center p-2 bg-primary/10 rounded">
                      <p className="text-lg font-bold text-primary">{redistributeResult.reassigned}</p>
                      <p className="text-xs text-muted-foreground">Reassigned</p>
                    </div>
                    <div className="text-center p-2 bg-background rounded">
                      <p className="text-lg font-bold">{redistributeResult.unchanged}</p>
                      <p className="text-xs text-muted-foreground">Unchanged</p>
                    </div>
                  </div>
                  
                  {/* Sample Changes */}
                  {redistributeResult.sampleChanges?.length > 0 && (
                    <Collapsible open={showChanges} onOpenChange={setShowChanges}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between">
                          <span className="text-sm font-medium">
                            View Sample Changes ({redistributeResult.sampleChanges.length})
                          </span>
                          {showChanges ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ScrollArea className="h-[150px] mt-2">
                          <div className="space-y-1">
                            {redistributeResult.sampleChanges.map((change, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs p-2 bg-background rounded">
                                <span className="font-medium truncate max-w-[150px]" title={change.clinic}>
                                  {change.clinic}
                                </span>
                                <span className="text-muted-foreground">{change.from}</span>
                                <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                                <span className="text-primary">{change.to}</span>
                                <Badge variant="outline" className="text-xs ml-auto">
                                  {change.distance}km
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>How it works:</strong> The system uses GPS coordinates to calculate the 
                distance between each clinic and all cities in the same state. Each clinic is 
                assigned to the nearest city.
              </p>
              <p>
                <strong>Requirements:</strong> Both cities and clinics need latitude/longitude 
                coordinates. Clinics without coordinates will be skipped. Cities without coordinates 
                won't be considered as destinations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
