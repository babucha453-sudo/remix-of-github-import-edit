import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  MapPin, 
  RefreshCw, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Building2,
  Clock,
  Loader2,
  Eye,
  ArrowRight,
  Filter,
  Download,
  Play,
  Pause,
  Zap,
  Globe,
  Flag
} from 'lucide-react';

interface ClinicLocationIssue {
  id: string;
  name: string;
  address: string;
  current_city_id: string | null;
  current_city_name: string | null;
  current_state_name: string | null;
  address_city_name: string | null;
  address_state_abbrev: string | null;
  detected_city_id: string | null;
  detected_city_name: string | null;
  is_matched: boolean;
  service_areas_count: number;
}

interface AuditStats {
  total: number;
  matched: number;
  mismatched: number;
  no_address: number;
  fixed: number;
}

const US_CITIES_KEYWORDS = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
  'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
  'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee',
  'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
  'los angeles', 'san diego', 'san francisco', 'san jose', 'sacramento', 'fresno', 'oakland',
  'long beach', 'bakersfield', 'anaheim', 'santa ana', 'riverside', 'stockton',
  'new york', 'brooklyn', 'queens', 'bronx', 'manhattan', 'staten island',
  'houston', 'dallas', 'austin', 'san antonio', 'fort worth', 'el paso',
  'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas',
  'san jose', 'austin', 'jacksonville', 'fort worth', 'columbus', 'charlotte', 'indianapolis',
  'seattle', 'denver', 'washington', 'boston', 'detroit', 'nashville', 'portland',
  'las vegas', 'memphis', 'louisville', 'baltimore', 'milwaukee', 'albuquerque',
  'tucson', 'fresno', 'mesa', 'sacramento', 'atlanta', 'miami', 'cleveland', 'ohio'
];

export default function LocationAuditTab() {
  const queryClient = useQueryClient();
  const [selectedState, setSelectedState] = useState<string>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'all' | 'mismatched' | 'matched'>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalClinics, setTotalClinics] = useState(0);
  const [fixAllClinics, setFixAllClinics] = useState<ClinicLocationIssue[]>([]);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [fixProgress, setFixProgress] = useState({ fixed: 0, total: 0, errors: 0 });
  const PAGE_SIZE = 100;
  
  // Reset page when state changes
  useEffect(() => {
    setCurrentPage(0);
    setTotalClinics(0);
  }, [selectedState]);

  // Fetch states for filter
  const { data: states = [], isLoading: statesLoading } = useQuery({
    queryKey: ['audit-states'],
    queryFn: async () => {
      const { data, error } = await supabase.from('states').select('id, name, abbreviation').order('name');
      console.log('States loaded:', data?.length, error);
      return data || [];
    },
  });

  console.log('Selected state:', selectedState, 'States count:', states.length);
  console.log('States:', states.map(s => s.abbreviation));

  // Fetch cities for the selected state
  const { data: stateCities = [] } = useQuery({
    queryKey: ['audit-cities', selectedState],
    queryFn: async () => {
      let query = supabase.from('cities').select('id, name, state_id, states(name, abbreviation)').order('name');
      if (selectedState !== 'all') {
        query = query.eq('state_id', selectedState);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: selectedState !== 'all',
  });

  // Fetch clinics with location issues (paginated)
  const { data: issues = [], isLoading: issuesLoading, refetch } = useQuery({
    queryKey: ['location-issues', selectedState, currentPage],
    queryFn: async () => {
      if (selectedState === 'all') return [];
      
      // Get city IDs for this state first
      const stateCityIds = stateCities.map(c => c.id);
      console.log('State city IDs count:', stateCityIds.length, 'for state:', selectedState);
      
      if (stateCityIds.length === 0) {
        console.log('No cities found for state');
        return [];
      }
      
      // First get total count
      const { count } = await supabase
        .from('clinics')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('city_id', stateCityIds);
      
      setTotalClinics(count || 0);
      console.log('Total clinics in state:', count);
      
      // Get paginated clinics from Supabase (default limit is 1000, use range for more control)
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data: clinics, error } = await supabase
        .from('clinics')
        .select(`
          id, name, address, city_id,
          cities(id, name, states(id, name, abbreviation))
        `)
        .eq('is_active', true)
        .in('city_id', stateCityIds)
        .order('name')
        .range(from, to);

      console.log('Clinics found:', clinics?.length, 'for state:', selectedState, 'page:', currentPage);
      
      if (error) {
        console.error('Error fetching clinics:', error);
        return [];
      }

      if (!clinics || clinics.length === 0) {
        console.log('No clinics found for state');
        return [];
      }

      // Also get their service areas
      const { data: serviceAreas } = await supabase
        .from('clinic_service_areas')
        .select('clinic_id, area_id, areas(id, name, cities(id, name))');

      // Create a map of service areas by clinic
      const serviceAreasMap = new Map();
      (serviceAreas || []).forEach(sa => {
        if (!serviceAreasMap.has(sa.clinic_id)) {
          serviceAreasMap.set(sa.clinic_id, []);
        }
        serviceAreasMap.get(sa.clinic_id).push(sa);
      });

      // Analyze each clinic
      const issuesList: ClinicLocationIssue[] = [];
      const currentState = states.find(s => s.id === selectedState);

      for (const clinic of clinics || []) {
        const clinicServiceAreas = serviceAreasMap.get(clinic.id) || [];
        const currentCityName = clinic.cities?.name;
        const currentStateName = clinic.cities?.states?.name;

        // Create simple city names array for matching
        const cityNames = stateCities.map(c => ({ name: c.name }));
        
        // Extract city from address using smart parsing with known cities
        const addressCity = extractCityFromAddress(clinic.address || '', cityNames);
        
        // Find matching city in database
        let detectedCityId = null;
        let detectedCityName = null;
        
        if (addressCity) {
          const matchedCity = stateCities.find(c => 
            c.name.toLowerCase() === addressCity.toLowerCase() ||
            c.name.toLowerCase().includes(addressCity.toLowerCase()) ||
            addressCity.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchedCity) {
            detectedCityId = matchedCity.id;
            detectedCityName = matchedCity.name;
          }
        }

        // Determine if there's a mismatch - more aggressive
        let isMatched = true;
        
        if (addressCity && currentCityName) {
          // If we extracted a city from address and it's different from current - it's a mismatch
          const addressClean = addressCity.toLowerCase().replace(/[^a-z]/g, '');
          const currentClean = currentCityName.toLowerCase().replace(/[^a-z]/g, '');
          
          if (addressClean !== currentClean && addressClean.length > 2 && currentClean.length > 2) {
            isMatched = false;
          }
        } else if (addressCity && !currentCityName) {
          // Has address city but no current city set - mismatch
          isMatched = false;
        }

        issuesList.push({
          id: clinic.id,
          name: clinic.name,
          address: clinic.address,
          current_city_id: clinic.city_id,
          current_city_name: currentCityName,
          current_state_name: currentStateName,
          address_city_name: addressCity,
          address_state_abbrev: currentState?.abbreviation || currentStateName?.substring(0, 2),
          detected_city_id: detectedCityId,
          detected_city_name: detectedCityName,
          is_matched: isMatched,
          service_areas_count: clinicServiceAreas.length,
        });
      }

      return issuesList;
    },
    enabled: selectedState !== 'all',
  });

  // Calculate stats
  const stats = useMemo((): AuditStats => {
    const matched = issues.filter(i => i.is_matched).length;
    const mismatched = issues.filter(i => !i.is_matched).length;
    const noAddress = issues.filter(i => !i.address || i.address.length < 5).length;
    return {
      total: totalClinics || issues.length,
      matched,
      mismatched,
      no_address: noAddress,
      fixed: matched,
    };
  }, [issues, totalClinics]);

  // Filter issues based on status
  const filteredIssues = useMemo(() => {
    if (filterStatus === 'all') return issues;
    if (filterStatus === 'mismatched') return issues.filter(i => !i.is_matched);
    if (filterStatus === 'matched') return issues.filter(i => i.is_matched);
    return issues;
  }, [issues, filterStatus]);

  // Fix single clinic
  const fixClinic = useMutation({
    mutationFn: async (clinic: ClinicLocationIssue) => {
      if (!clinic.detected_city_id || !clinic.current_city_id) return;

      // Update clinic city_id
      const { error: clinicError } = await supabase
        .from('clinics')
        .update({ 
          city_id: clinic.detected_city_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', clinic.id);

      if (clinicError) throw clinicError;

      // Update service areas to new city
      const { data: currentAreas } = await supabase
        .from('clinic_service_areas')
        .select('id, area_id, areas(city_id)')
        .eq('clinic_id', clinic.id)
        .eq('is_active', true);

      // Get areas in the new city
      const { data: newCityAreas } = await supabase
        .from('areas')
        .select('id')
        .eq('city_id', clinic.detected_city_id);

      // Deactivate old areas
      for (const oldArea of currentAreas || []) {
        await supabase
          .from('clinic_service_areas')
          .update({ is_active: false })
          .eq('id', oldArea.id);
      }

      // Add new areas from detected city
      for (const area of newCityAreas || []) {
        await supabase
          .from('clinic_service_areas')
          .insert({
            clinic_id: clinic.id,
            area_id: area.id,
            is_primary: true,
          });
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-issues'] });
      toast.success('Clinic location fixed!');
    },
    onError: (e: Error) => {
      toast.error('Failed: ' + e.message);
    },
  });

  // Scan all clinics in state (runs in batches)
  const runAudit = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      setScanProgress(0);
      setCurrentScanIndex(0);

      // Just refresh the data - actual scanning is done via the query
      await refetch();
      
      setScanProgress(100);
      setIsScanning(false);
      toast.success('Audit complete!');
    },
  });

  // Auto-fix ALL mismatched clinics in the entire state (not just current page)
  const autoFixAll = useMutation({
    mutationFn: async () => {
      if (selectedState === 'all') return { fixed: 0, errors: 0 };
      
      setIsFixingAll(true);
      setFixProgress({ fixed: 0, total: 0, errors: 0 });
      
      // First, get ALL city IDs for the state (fetch all pages)
      const stateCityIds = stateCities.map(c => c.id);
      
      if (stateCityIds.length === 0) {
        return { fixed: 0, errors: 0 };
      }
      
      // Get total count first
      const { count } = await supabase
        .from('clinics')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('city_id', stateCityIds);
      
      const totalClinicsInState = count || 0;
      
      // Now fetch ALL clinics in the state (no pagination for the fix)
      let allClinics: any[] = [];
      let offset = 0;
      const BATCH_SIZE = 1000;
      
      // Fetch in batches until we have all
      while (offset < totalClinicsInState) {
        const { data } = await supabase
          .from('clinics')
          .select('id, name, address, city_id, cities(id, name, states(id, name, abbreviation))')
          .eq('is_active', true)
          .in('city_id', stateCityIds)
          .order('name')
          .range(offset, offset + BATCH_SIZE - 1);
        
        if (data) allClinics = [...allClinics, ...data];
        offset += BATCH_SIZE;
      }
      
      console.log('Fetched all clinics:', allClinics.length);
      
      // Get all service areas
      const { data: serviceAreas } = await supabase
        .from('clinic_service_areas')
        .select('clinic_id, area_id');
      
      const serviceAreasMap = new Map();
      (serviceAreas || []).forEach(sa => {
        if (!serviceAreasMap.has(sa.clinic_id)) {
          serviceAreasMap.set(sa.clinic_id, []);
        }
        serviceAreasMap.get(sa.clinic_id).push(sa);
      });
      
      // Get ALL cities in the state (not just the ones assigned to clinics)
      const { data: allStateCities } = await supabase
        .from('cities')
        .select('id, name')
        .eq('state_id', selectedState)
        .order('name');
      
      const stateCitiesMap = new Map<string, string>(); // name -> id
      (allStateCities || []).forEach(c => {
        stateCitiesMap.set(c.name.toLowerCase(), c.id);
        stateCitiesMap.set(c.name.toLowerCase().replace(/[^a-z]/g, ''), c.id);
      });
      
      // Analyze each clinic and find mismatches
      const mismatchedClinics: ClinicLocationIssue[] = [];
      
      // Now analyze clinics and find all mismatches
      for (const clinic of allClinics) {
        const currentCityName = clinic.cities?.name;
        
        // Extract city from address using our smart function
        const cityNames = stateCities.map(c => ({ name: c.name }));
        const addressCity = extractCityFromAddress(clinic.address || '', cityNames);
        
        // Find matching city in database
        let detectedCityId = null;
        let detectedCityName = null;
        
        if (addressCity) {
          // Check against ALL state cities (not just the ones with clinics)
          const addressClean = addressCity.toLowerCase().replace(/[^a-z]/g, '');
          
          // Direct match
          if (stateCitiesMap.has(addressCity.toLowerCase())) {
            detectedCityId = stateCitiesMap.get(addressCity.toLowerCase());
            detectedCityName = addressCity;
          } else if (stateCitiesMap.has(addressClean)) {
            // Fuzzy match (no spaces/punctuation)
            detectedCityId = stateCitiesMap.get(addressClean);
            detectedCityName = addressCity;
          } else {
            // Try partial match
            for (const [cityName, cityId] of stateCitiesMap) {
              if (cityName.includes(addressClean) || addressClean.includes(cityName)) {
                detectedCityId = cityId;
                detectedCityName = addressCity;
                break;
              }
            }
          }
        }
        
        // Check if there's a mismatch - ANY difference should be flagged
        const isDifferent = addressCity && detectedCityId && detectedCityId !== clinic.city_id;
        const hasAddressButNoMatch = addressCity && !detectedCityId && !currentCityName?.toLowerCase().includes(addressCity.toLowerCase());
        
        if (isDifferent || hasAddressButNoMatch) {
          mismatchedClinics.push({
            id: clinic.id,
            name: clinic.name,
            address: clinic.address,
            current_city_id: clinic.city_id,
            current_city_name: currentCityName,
            current_state_name: clinic.cities?.states?.name,
            address_city_name: addressCity,
            address_state_abbrev: clinic.cities?.states?.abbreviation,
            detected_city_id: detectedCityId,
            detected_city_name: detectedCityName || addressCity,
            is_matched: false,
            service_areas_count: (serviceAreasMap.get(clinic.id) || []).length,
          });
        }
      }
      
      console.log('Mismatched clinics found:', mismatchedClinics.length);
      
      // Now fix ALL mismatched clinics
      let fixed = 0;
      let errors = 0;
      const FIX_BATCH_SIZE = 50;
      
      for (let i = 0; i < mismatchedClinics.length; i++) {
        const clinic = mismatchedClinics[i];
        
        try {
          // Update clinic city_id
          const { error: clinicError } = await supabase
            .from('clinics')
            .update({ 
              city_id: clinic.detected_city_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', clinic.id);
          
          if (!clinicError) {
            fixed++;
          } else {
            errors++;
            console.error('Error fixing clinic:', clinic.name, clinicError);
          }
        } catch (e) {
          errors++;
        }
        
        // Update progress every 50 clinics
        if (i % FIX_BATCH_SIZE === 0 || i === mismatchedClinics.length - 1) {
          setFixProgress({
            fixed,
            total: mismatchedClinics.length,
            errors
          });
        }
      }
      
      return { fixed, errors, total: mismatchedClinics.length };
    },
    onSuccess: (result) => {
      setIsFixingAll(false);
      queryClient.invalidateQueries({ queryKey: ['location-issues'] });
      if (result.errors > 0) {
        toast.success(`Fixed ${result.fixed} clinics with ${result.errors} errors!`);
      } else {
        toast.success(`Successfully fixed all ${result.fixed} clinic locations!`);
      }
    },
    onError: (e: Error) => {
      setIsFixingAll(false);
      toast.error('Error during fix: ' + e.message);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            Location Audit & Fix
          </h1>
          <p className="text-muted-foreground mt-1">
            Audit clinic locations based on their addresses and fix mismatches
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(state => (
                <SelectItem key={state.id} value={state.id}>
                  {state.name} ({state.abbreviation})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={() => runAudit.mutate()} 
            disabled={selectedState === 'all' || isScanning || issuesLoading}
            variant="outline"
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Run Audit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clinics</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Correct Location</p>
                <p className="text-3xl font-bold text-green-600">{stats.matched}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Wrong Location</p>
                <p className="text-3xl font-bold text-red-600">{stats.mismatched}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">No Address</p>
                <p className="text-3xl font-bold text-amber-600">{stats.no_address}</p>
              </div>
              <XCircle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fix All Button - Always visible when state selected */}
      {selectedState !== 'all' && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              Bulk Fix All Locations
            </CardTitle>
            <CardDescription>
              This will scan ALL {totalClinics} clinics in this state and fix any with wrong location based on their address.
              Progress will be shown below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="destructive"
                size="lg"
                onClick={() => autoFixAll.mutate()}
                disabled={autoFixAll.isPending || isFixingAll || totalClinics === 0}
                className="min-w-[250px]"
              >
                {autoFixAll.isPending || isFixingAll ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {isFixingAll 
                      ? `Fixing ${fixProgress.fixed} of ${fixProgress.total}...` 
                      : 'Processing all clinics...'
                    }
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Fix All Wrong Locations
                  </>
                )}
              </Button>
              
              {totalClinics > 0 && (
                <div className="text-sm text-muted-foreground">
                  Total clinics to scan: <strong>{totalClinics}</strong>
                </div>
              )}
            </div>

            {(isScanning || isFixingAll) && (
              <div className="space-y-2">
                <Progress value={isFixingAll ? (fixProgress.fixed / Math.max(fixProgress.total, 1)) * 100 : scanProgress} className="h-4" />
                <div className="flex justify-between text-sm">
                  {isFixingAll ? (
                    <>
                      <span className="font-medium text-green-600">
                        Fixed: {fixProgress.fixed}
                      </span>
                      <span className={fixProgress.errors > 0 ? "text-red-600" : "text-muted-foreground"}>
                        Errors: {fixProgress.errors}
                      </span>
                      <span className="text-muted-foreground">
                        Remaining: {fixProgress.total - fixProgress.fixed - fixProgress.errors}
                      </span>
                      <span className="font-medium">
                        {((fixProgress.fixed / Math.max(fixProgress.total, 1)) * 100).toFixed(1)}% complete
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Scanning clinics... {scanProgress}%</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {selectedState !== 'all' && issuesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2">Scanning clinics...</span>
        </div>
      ) : filteredIssues.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Clinic Location Issues ({filteredIssues.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic Name</TableHead>
                    <TableHead>Current City</TableHead>
                    <TableHead>Address City</TableHead>
                    <TableHead>Detected City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map(clinic => (
                    <TableRow key={clinic.id} className={!clinic.is_matched ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{clinic.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{clinic.current_city_name || 'Not set'}</Badge>
                      </TableCell>
                      <TableCell>{clinic.address_city_name || '-'}</TableCell>
                      <TableCell>
                        {clinic.detected_city_name ? (
                          <Badge variant="default">{clinic.detected_city_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Not found</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {clinic.is_matched ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Mismatch
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!clinic.is_matched && clinic.detected_city_id && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => fixClinic.mutate(clinic)}
                            disabled={fixClinic.isPending}
                          >
                            {fixClinic.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                Fix <ArrowRight className="h-3 w-3 ml-1" />
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalClinics)} of {totalClinics} clinics
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={(currentPage + 1) * PAGE_SIZE >= totalClinics}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : selectedState === 'all' ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Select a State to Audit</p>
            <p className="text-muted-foreground">Choose a state from the dropdown above to scan all clinics in that state.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">No Issues Found</p>
            <p className="text-muted-foreground">All clinics in this state have correct location data.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Smart city extraction from address
function extractCityFromAddress(address: string, citiesInState: { name: string }[]): string | null {
  if (!address || address.length < 5) return null;
  
  // Clean the address
  const cleaned = address.trim();
  
  // Strategy 1: Look for pattern "Street, City, State ZIP" or "Street, City State ZIP"
  // The city is typically BEFORE the state abbreviation or state name
  const commaParts = cleaned.split(',').map(p => p.trim());
  
  // Look at last part for state+zip, second-to-last for city
  for (let i = 0; i < commaParts.length; i++) {
    const part = commaParts[i];
    const nextPart = commaParts[i + 1];
    
    // Check if this part looks like city (no numbers, but next part has zip or state)
    if (nextPart) {
      // Pattern: "CityName CA 12345" or "CityName California"
      if (nextPart.match(/\b[A-Z]{2}\s*\d{5}/) || nextPart.match(/[A-Za-z]+\s+\d{5}/)) {
        // Remove street suffixes from city name
        const city = part
          .replace(/\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Plaza|Suite|Floor|Ste|Unit|#)\b\.?\s*\w*\.?$/gi, '')
          .replace(/\d+/, '')
          .trim();
        if (city && city.length > 2 && !city.match(/^\d+$/)) {
          return city;
        }
      }
    }
  }
  
  // Strategy 2: Try matching against known cities in the state
  const addressLower = cleaned.toLowerCase();
  for (const city of citiesInState) {
    const cityLower = city.name.toLowerCase();
    // Check if city name appears in address
    if (addressLower.includes(cityLower) && cityLower.length > 2) {
      return city.name;
    }
  }
  
  // Strategy 3: Last-ditch - take second-to-last comma part
  if (commaParts.length >= 2) {
    const cityPart = commaParts[commaParts.length - 2]
      .replace(/\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\b\.?$/gi, '')
      .replace(/\d{5}(-\d{4})?$/, '')
      .trim();
    if (cityPart && cityPart.length > 2) {
      return cityPart;
    }
  }
  
  return null;
}