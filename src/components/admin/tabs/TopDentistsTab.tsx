import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, 
  Star, 
  Pin, 
  PinOff,
  Building2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';

interface PinnedClinic {
  id: string;
  clinic_id: string;
  city_id: string;
  display_order: number;
  clinic?: { id: string; name: string; slug: string; rating: number; review_count: number };
}

export default function TopDentistsTab() {
  const queryClient = useQueryClient();
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [localPins, setLocalPins] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch cities
  const { data: cities } = useQuery({
    queryKey: ['cities-for-top'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch areas for selected city
  const { data: areas } = useQuery({
    queryKey: ['areas-for-top', selectedCity],
    queryFn: async () => {
      const { data } = await supabase
        .from('areas')
        .select('id, name, slug')
        .eq('city_id', selectedCity)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!selectedCity,
  });

  // Build the settings key based on city and optional area
  const settingsKey = selectedArea 
    ? `pinned_clinics_${selectedCity}_${selectedArea}` 
    : `pinned_clinics_${selectedCity}`;

  // Fetch pinned clinics from global_settings
  const { data: pinnedData } = useQuery({
    queryKey: ['pinned-clinics', settingsKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', settingsKey)
        .maybeSingle();
      
      const pinnedIds = (data?.value as string[]) || [];
      setLocalPins(pinnedIds);
      return pinnedIds;
    },
    enabled: !!selectedCity,
  });

  // Fetch clinics for selected city/area
  const { data: clinics, isLoading } = useQuery({
    queryKey: ['clinics-for-pinning', selectedCity, selectedArea],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select('id, name, slug, rating, review_count, verification_status, claim_status, area:areas(name)')
        .eq('city_id', selectedCity)
        .eq('is_active', true);
      
      if (selectedArea) {
        query = query.eq('area_id', selectedArea);
      }
      
      const { data } = await query
        .order('verification_status', { ascending: false })
        .order('rating', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!selectedCity,
  });

  // Save pinned clinics
  const savePins = useMutation({
    mutationFn: async () => {
      // Check if exists
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', settingsKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('global_settings')
          .update({ value: localPins as unknown as Record<string, never>, updated_at: new Date().toISOString() })
          .eq('key', settingsKey);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .insert([{ key: settingsKey, value: localPins as unknown as Record<string, never> }]);
        if (error) throw error;
      }

      await createAuditLog({
        action: 'UPDATE_PINNED_CLINICS',
        entityType: 'global_settings',
        entityId: settingsKey,
        newValues: { pinned_clinics: localPins, area: selectedArea || null },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-clinics', settingsKey] });
      toast.success('Pinned clinics saved');
      setHasChanges(false);
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Reset area when city changes
  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    setSelectedArea('');
    setLocalPins([]);
    setHasChanges(false);
  };

  const togglePin = (clinicId: string) => {
    setLocalPins(prev => {
      const newPins = prev.includes(clinicId)
        ? prev.filter(id => id !== clinicId)
        : prev.length < 10 ? [...prev, clinicId] : prev;
      setHasChanges(true);
      return newPins;
    });
  };

  const moveUp = (clinicId: string) => {
    setLocalPins(prev => {
      const index = prev.indexOf(clinicId);
      if (index <= 0) return prev;
      const newPins = [...prev];
      [newPins[index - 1], newPins[index]] = [newPins[index], newPins[index - 1]];
      setHasChanges(true);
      return newPins;
    });
  };

  const moveDown = (clinicId: string) => {
    setLocalPins(prev => {
      const index = prev.indexOf(clinicId);
      if (index < 0 || index >= prev.length - 1) return prev;
      const newPins = [...prev];
      [newPins[index], newPins[index + 1]] = [newPins[index + 1], newPins[index]];
      setHasChanges(true);
      return newPins;
    });
  };

  const clearPins = () => {
    setLocalPins([]);
    setHasChanges(true);
  };

  // Sort clinics: pinned first, then by verification/rating
  const sortedClinics = clinics?.slice().sort((a, b) => {
    const aPinIndex = localPins.indexOf(a.id);
    const bPinIndex = localPins.indexOf(b.id);
    
    // Pinned clinics come first
    if (aPinIndex >= 0 && bPinIndex < 0) return -1;
    if (bPinIndex >= 0 && aPinIndex < 0) return 1;
    if (aPinIndex >= 0 && bPinIndex >= 0) return aPinIndex - bPinIndex;
    
    // Then by rating
    return (b.rating || 0) - (a.rating || 0);
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Top Dentists Selection</h1>
          <p className="text-muted-foreground mt-1">Manually select Top 10 clinics per city or area</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedCity} onValueChange={handleCityChange}>
            <SelectTrigger className="w-48 bg-background">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select city..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {cities?.map((city) => (
                <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCity && areas && areas.length > 0 && (
            <Select 
              value={selectedArea || "all"} 
              onValueChange={(val) => setSelectedArea(val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-48 bg-background">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All areas" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">All Areas (City-wide)</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasChanges && (
            <Button onClick={() => savePins.mutate()} disabled={savePins.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {!selectedCity ? (
        <Card className="card-modern">
          <CardContent className="py-12 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a city to manage top clinics</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pinned Summary */}
          <Card className="card-modern">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
                    <Pin className="h-6 w-6 text-gold" />
                  </div>
                <div>
                    <p className="font-bold">{localPins.length} / 10 Pinned</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedArea ? `Area: ${areas?.find(a => a.id === selectedArea)?.name}` : 'City-wide pins'} • {localPins.length < 10 ? `${10 - localPins.length} slots available` : 'Maximum reached'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={clearPins} disabled={localPins.length === 0}>
                  <PinOff className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Clinics Table */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg">
                Clinics in {cities?.find(c => c.id === selectedCity)?.name}
                {selectedArea && ` › ${areas?.find(a => a.id === selectedArea)?.name}`}
              </CardTitle>
              <CardDescription>
                Pinned clinics will appear at the top of search results for this {selectedArea ? 'area' : 'city'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pinned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedClinics.map((clinic, index) => {
                      const isPinned = localPins.includes(clinic.id);
                      const pinIndex = localPins.indexOf(clinic.id);
                      
                      return (
                        <TableRow key={clinic.id} className={isPinned ? 'bg-gold/5' : ''}>
                          <TableCell className="font-bold">
                            {isPinned ? (
                              <Badge className="bg-gold text-white">{pinIndex + 1}</Badge>
                            ) : (
                              <span className="text-muted-foreground">{index + 1}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isPinned ? 'bg-gold/10' : 'bg-muted'}`}>
                                <Building2 className={`h-5 w-5 ${isPinned ? 'text-gold' : 'text-muted-foreground'}`} />
                              </div>
                              <div>
                                <p className="font-medium">{clinic.name}</p>
                                <p className="text-xs text-muted-foreground">{clinic.slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-gold fill-gold" />
                              <span className="font-medium">{clinic.rating || 0}</span>
                              <span className="text-muted-foreground text-sm">({clinic.review_count || 0})</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {clinic.verification_status === 'verified' && (
                                <Badge className="bg-teal/20 text-teal text-xs">Verified</Badge>
                              )}
                              {clinic.claim_status === 'claimed' && (
                                <Badge variant="outline" className="text-xs">Claimed</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isPinned ? (
                              <Pin className="h-4 w-4 text-gold fill-gold" />
                            ) : (
                              <PinOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isPinned && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveUp(clinic.id)}
                                    disabled={pinIndex === 0}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveDown(clinic.id)}
                                    disabled={pinIndex === localPins.length - 1}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant={isPinned ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => togglePin(clinic.id)}
                                disabled={!isPinned && localPins.length >= 10}
                              >
                                {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
