import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ACTIVE_STATE_SLUGS } from '@/lib/constants/activeStates';
import { 
  Pin, 
  Save, 
  Star,
  ArrowUp,
  ArrowDown,
  X,
  Shield,
  CheckCircle,
  MapPin,
  Home,
  Trash2,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

interface PinnedClinic {
  id: string;
  position: number;
  featured: boolean;
}

type PageType = 'homepage' | 'state' | 'city' | 'service';

export default function PinnedProfilesTab() {
  const queryClient = useQueryClient();
  const [pageType, setPageType] = useState<PageType>('homepage');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [pinnedClinics, setPinnedClinics] = useState<PinnedClinic[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');

  // Fetch states (active states only)
  const { data: states } = useQuery({
    queryKey: ['admin-states-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('states')
        .select('id, name, slug')
        .eq('is_active', true)
        .in('slug', ACTIVE_STATE_SLUGS)
        .order('name');
      return data || [];
    },
  });

  // Fetch cities based on selected state
  const { data: cities } = useQuery({
    queryKey: ['admin-cities', selectedState],
    queryFn: async () => {
      if (!selectedState) return [];
      const { data } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('state_id', selectedState)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!selectedState,
  });

  // Fetch treatments/services
  const { data: treatments } = useQuery({
    queryKey: ['admin-treatments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treatments')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
  });

  // Generate setting key based on page selection
  const getSettingKey = () => {
    if (pageType === 'homepage') return 'pinned_clinics_homepage';
    if (pageType === 'state' && selectedState) {
      const state = states?.find(s => s.id === selectedState);
      return `pinned_clinics_state_${state?.slug}`;
    }
    if (pageType === 'city' && selectedCity) {
      const city = cities?.find(c => c.id === selectedCity);
      const state = states?.find(s => s.id === selectedState);
      return `pinned_clinics_city_${state?.slug}_${city?.slug}`;
    }
    if (pageType === 'service' && selectedService) {
      const treatment = treatments?.find(t => t.id === selectedService);
      return `pinned_clinics_service_${treatment?.slug}`;
    }
    return null;
  };

  const settingKey = getSettingKey();

  // Fetch current pinned clinics for the selected page
  const { data: currentPins, isLoading: pinsLoading } = useQuery({
    queryKey: ['pinned-clinics', settingKey],
    queryFn: async () => {
      if (!settingKey) return null;
      const { data } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', settingKey)
        .maybeSingle();
      return data;
    },
    enabled: !!settingKey,
  });

  // Effect to load pins when data changes
  const loadPins = () => {
    if (currentPins?.value) {
      try {
        const pins = typeof currentPins.value === 'string' 
          ? JSON.parse(currentPins.value) 
          : currentPins.value;
        setPinnedClinics(Array.isArray(pins) ? pins : []);
      } catch {
        setPinnedClinics([]);
      }
    } else {
      setPinnedClinics([]);
    }
    setHasChanges(false);
  };

  // Helper to fetch all clinics without limit
  const fetchAllPinnableClinics = async () => {
    const allClinics: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    // Get city filter for state page
    let cityIds: string[] = [];
    if (pageType === 'state' && selectedState) {
      const { data: stateCities } = await supabase
        .from('cities')
        .select('id')
        .eq('state_id', selectedState);
      cityIds = stateCities?.map(c => c.id) || [];
    }

    while (hasMore) {
      let query = supabase
        .from('clinics')
        .select(`
          id, name, slug, rating, review_count, verification_status, claim_status,
          city:cities(id, name, slug, state:states(id, name, slug, abbreviation))
        `)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .range(from, from + batchSize - 1);

      if (pageType === 'city' && selectedCity) {
        query = query.eq('city_id', selectedCity);
      } else if (pageType === 'state' && selectedState && cityIds.length > 0) {
        query = query.in('city_id', cityIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        allClinics.push(...data);
        from += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    return allClinics;
  };

  // Fetch ALL clinics for selection - NO LIMIT
  const { data: availableClinics } = useQuery({
    queryKey: ['available-clinics-unlimited', pageType, selectedState, selectedCity],
    queryFn: fetchAllPinnableClinics,
    enabled: pageType === 'homepage' || !!selectedState || !!selectedCity,
  });

  // Save mutation
  const savePins = useMutation({
    mutationFn: async () => {
      if (!settingKey) throw new Error('No page selected');
      
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', settingKey)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('global_settings')
          .update({
            value: pinnedClinics as unknown as import('@/integrations/supabase/types').Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('global_settings')
          .insert({
            key: settingKey,
            value: pinnedClinics as unknown as import('@/integrations/supabase/types').Json,
          });
      }
    },
    onSuccess: () => {
      toast.success('Pinned profiles saved!');
      queryClient.invalidateQueries({ queryKey: ['pinned-clinics'] });
      setHasChanges(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePin = (clinicId: string) => {
    const exists = pinnedClinics.find(p => p.id === clinicId);
    if (exists) {
      setPinnedClinics(pinnedClinics.filter(p => p.id !== clinicId));
    } else {
      if (pinnedClinics.length >= 10) {
        toast.error('Maximum 10 pinned profiles allowed');
        return;
      }
      setPinnedClinics([...pinnedClinics, { id: clinicId, position: pinnedClinics.length + 1, featured: false }]);
    }
    setHasChanges(true);
  };

  const toggleFeatured = (clinicId: string, featured: boolean) => {
    setPinnedClinics(pinnedClinics.map(p => 
      p.id === clinicId ? { ...p, featured } : p
    ));
    setHasChanges(true);
  };

  const moveUp = (clinicId: string) => {
    const index = pinnedClinics.findIndex(p => p.id === clinicId);
    if (index > 0) {
      const newPins = [...pinnedClinics];
      [newPins[index - 1], newPins[index]] = [newPins[index], newPins[index - 1]];
      setPinnedClinics(newPins.map((p, i) => ({ ...p, position: i + 1 })));
      setHasChanges(true);
    }
  };

  const moveDown = (clinicId: string) => {
    const index = pinnedClinics.findIndex(p => p.id === clinicId);
    if (index < pinnedClinics.length - 1) {
      const newPins = [...pinnedClinics];
      [newPins[index], newPins[index + 1]] = [newPins[index + 1], newPins[index]];
      setPinnedClinics(newPins.map((p, i) => ({ ...p, position: i + 1 })));
      setHasChanges(true);
    }
  };

  const clearPins = () => {
    setPinnedClinics([]);
    setHasChanges(true);
  };

  const getClinicById = (id: string) => availableClinics?.find(c => c.id === id);

  const pinnedClinicDetails = pinnedClinics
    .map(p => ({ ...p, clinic: getClinicById(p.id) }))
    .filter(p => p.clinic);

  const unpinnedClinics = availableClinics?.filter(
    c => !pinnedClinics.some(p => p.id === c.id)
  ) || [];

  // Filter unpinned clinics by search query
  const filteredUnpinnedClinics = useMemo(() => {
    if (!clinicSearchQuery.trim()) return unpinnedClinics;
    const query = clinicSearchQuery.toLowerCase();
    return unpinnedClinics.filter((c: any) =>
      c.name?.toLowerCase().includes(query) ||
      c.slug?.toLowerCase().includes(query) ||
      c.city?.name?.toLowerCase().includes(query) ||
      c.city?.state?.name?.toLowerCase().includes(query) ||
      c.city?.state?.abbreviation?.toLowerCase().includes(query)
    );
  }, [unpinnedClinics, clinicSearchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Pinned Profiles</h1>
          <p className="text-muted-foreground mt-1">Select which clinics appear at the top of each page</p>
        </div>
        {hasChanges && (
          <Button onClick={() => savePins.mutate()} disabled={savePins.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        )}
      </div>

      {/* Page Selection */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Select Page
          </CardTitle>
          <CardDescription>Choose which page you want to configure pinned profiles for</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Page Type</label>
              <Select value={pageType} onValueChange={(v: PageType) => {
                setPageType(v);
                setSelectedState('');
                setSelectedCity('');
                setSelectedService('');
                setPinnedClinics([]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homepage">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Homepage
                    </div>
                  </SelectItem>
                  <SelectItem value="state">State Page</SelectItem>
                  <SelectItem value="city">City Page</SelectItem>
                  <SelectItem value="service">Service Page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(pageType === 'state' || pageType === 'city') && (
              <div>
                <label className="text-sm font-medium mb-2 block">State</label>
                <Select value={selectedState} onValueChange={(v) => {
                  setSelectedState(v);
                  setSelectedCity('');
                  setPinnedClinics([]);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states?.map((state) => (
                      <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {pageType === 'city' && selectedState && (
              <div>
                <label className="text-sm font-medium mb-2 block">City</label>
                <Select value={selectedCity} onValueChange={(v) => {
                  setSelectedCity(v);
                  setPinnedClinics([]);
                  loadPins();
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities?.map((city) => (
                      <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {pageType === 'service' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Service</label>
                <Select value={selectedService} onValueChange={(v) => {
                  setSelectedService(v);
                  setPinnedClinics([]);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {treatments?.map((treatment) => (
                      <SelectItem key={treatment.id} value={treatment.id}>{treatment.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {settingKey && (
              <div className="flex items-end">
                <Button variant="outline" onClick={loadPins} className="w-full">
                  Load Current Pins
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pinned Clinics */}
      {settingKey && (
        <Card className="card-modern">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pin className="h-5 w-5 text-primary" />
                  Pinned Clinics ({pinnedClinics.length}/10)
                </CardTitle>
                <CardDescription>These clinics will appear at the top of the page in order</CardDescription>
              </div>
              {pinnedClinics.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearPins}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pinnedClinicDetails.length > 0 ? (
              <div className="space-y-2">
                {pinnedClinicDetails.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => moveUp(item.id)} disabled={index === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => moveDown(item.id)} disabled={index === pinnedClinicDetails.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <Badge className="bg-primary text-primary-foreground font-bold">#{index + 1}</Badge>
                    <div className="flex-1">
                      <p className="font-bold">{item.clinic?.name}</p>
                      <p className="text-sm text-muted-foreground">{item.clinic?.city?.name}, {item.clinic?.city?.state?.abbreviation}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.featured}
                          onCheckedChange={(v) => toggleFeatured(item.id, v)}
                        />
                        <span className="text-sm font-medium">Featured</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-gold fill-gold" />
                        <span className="font-medium">{item.clinic?.rating || 0}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => togglePin(item.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Pin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No pinned clinics yet. Select clinics from the list below.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Clinics */}
      {settingKey && (
        <Card className="card-modern">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Available Clinics ({filteredUnpinnedClinics.length.toLocaleString()})</CardTitle>
                <CardDescription>Click to pin clinics to the top of the page</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clinics..."
                  value={clinicSearchQuery}
                  onChange={(e) => setClinicSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 sticky top-0 bg-background">Pin</TableHead>
                    <TableHead className="sticky top-0 bg-background">Clinic</TableHead>
                    <TableHead className="sticky top-0 bg-background">Location</TableHead>
                    <TableHead className="sticky top-0 bg-background">Status</TableHead>
                    <TableHead className="sticky top-0 bg-background">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnpinnedClinics.map((clinic: any) => (
                    <TableRow key={clinic.id} className="cursor-pointer hover:bg-muted/50" onClick={() => togglePin(clinic.id)}>
                      <TableCell>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Pin className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{clinic.name}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {clinic.city?.name}, {clinic.city?.state?.abbreviation}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {clinic.verification_status === 'verified' && (
                            <Badge className="bg-teal/20 text-teal"><Shield className="h-3 w-3 mr-1" />Verified</Badge>
                          )}
                          {clinic.claim_status === 'claimed' && (
                            <Badge className="bg-primary/20 text-primary"><CheckCircle className="h-3 w-3 mr-1" />Claimed</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-gold fill-gold" />
                          <span className="font-medium">{clinic.rating || 0}</span>
                          <span className="text-muted-foreground text-xs">({clinic.review_count || 0})</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUnpinnedClinics.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {pinsLoading ? 'Loading...' : clinicSearchQuery ? 'No clinics match your search' : 'No clinics available for this page'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!settingKey && (
        <Card className="card-modern">
          <CardContent className="py-12 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Select a page type and location above to manage pinned profiles.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
