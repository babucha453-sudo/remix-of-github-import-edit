import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Star, Loader2, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ContentBlock } from './BlogContentBlockEditor';

interface DentistListInserterProps {
  blocks: ContentBlock[];
  onInsert: (blocks: ContentBlock[], insertAfterIndex: number | null) => void;
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
  cover_image_url: string | null;
}

export default function DentistListInserter({ blocks, onInsert }: DentistListInserterProps) {
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [limit, setLimit] = useState<string>('5');
  const [isExpanded, setIsExpanded] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState<string>('end');

  // Fetch states
  const { data: states } = useQuery({
    queryKey: ['blog-insert-states'],
    queryFn: async () => {
      const { data } = await supabase
        .from('states')
        .select('id, name, slug, abbreviation')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch cities for selected state
  const { data: cities } = useQuery({
    queryKey: ['blog-insert-cities', selectedState],
    enabled: !!selectedState,
    queryFn: async () => {
      const { data } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('state_id', selectedState)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch top clinics for selected city
  const { data: clinics, isLoading: loadingClinics } = useQuery({
    queryKey: ['blog-insert-clinics', selectedCity, limit],
    enabled: !!selectedCity,
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name, slug, address, phone, rating, review_count, cover_image_url')
        .eq('city_id', selectedCity)
        .eq('is_active', true)
        .eq('is_duplicate', false)
        .order('rating', { ascending: false, nullsFirst: false })
        .order('review_count', { ascending: false, nullsFirst: false })
        .limit(parseInt(limit));
      return data as Clinic[] || [];
    },
  });

  const selectedStateName = states?.find(s => s.id === selectedState)?.name || '';
  const selectedStateAbbr = states?.find(s => s.id === selectedState)?.abbreviation || '';
  const selectedCityName = cities?.find(c => c.id === selectedCity)?.name || '';

  // Get block labels for position selector
  const blockOptions = blocks.map((block, index) => ({
    value: index.toString(),
    label: block.type === 'heading' 
      ? `${block.headingLevel?.toUpperCase()}: ${block.headingText?.slice(0, 40) || 'Untitled'}${(block.headingText?.length || 0) > 40 ? '...' : ''}`
      : block.type === 'dentist-list'
        ? `Dentist List: ${block.locationLabel}`
        : block.type === 'faq-list'
          ? `FAQ Section (${block.faqs?.length || 0} items)`
          : `Image: ${block.imageAlt?.slice(0, 30) || 'No alt'}`,
  }));

  const handleInsert = () => {
    if (!clinics || clinics.length === 0) {
      toast.error('No clinics to insert');
      return;
    }

    const locationLabel = `${selectedCityName}, ${selectedStateAbbr}`;
    
    // Create a single dentist-list block that stores clinic IDs
    // The BlogPostPage will render these dynamically with proper UI
    const dentistListBlock: ContentBlock = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'dentist-list',
      clinicIds: clinics.map(c => c.id),
      locationLabel: locationLabel,
      headingText: `Top ${limit} Dentists in ${locationLabel}`,
    };

    const insertIndex = insertAfterIndex === 'end' 
      ? null 
      : insertAfterIndex === 'start' 
        ? -1 
        : parseInt(insertAfterIndex);

    onInsert([dentistListBlock], insertIndex);
    toast.success(`Inserted Top ${limit} dentists from ${locationLabel}`);
    
    // Reset selection
    setIsExpanded(false);
  };

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal/5">
      <CardHeader className="p-4 pb-2">
        <button 
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            Insert Dentist List
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          Add a curated list of top dentists with booking buttons (same UI as location pages)
        </p>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-4 pt-2 space-y-4">
          {/* State Selection */}
          <div className="space-y-2">
            <Label className="text-xs">Select State</Label>
            <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setSelectedCity(''); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose a state..." />
              </SelectTrigger>
              <SelectContent>
                {states?.map(state => (
                  <SelectItem key={state.id} value={state.id}>
                    <span className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {state.name} ({state.abbreviation})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* City Selection */}
          {selectedState && (
            <div className="space-y-2">
              <Label className="text-xs">Select City</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a city..." />
                </SelectTrigger>
                <SelectContent>
                  {cities?.map(city => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Limit & Position Selection */}
          {selectedCity && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Number of Dentists</Label>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Top 3</SelectItem>
                    <SelectItem value="5">Top 5</SelectItem>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="15">Top 15</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Insert Position</Label>
                <Select value={insertAfterIndex} onValueChange={setInsertAfterIndex}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">At Beginning</SelectItem>
                    {blockOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        After: {opt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="end">At End</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedCity && clinics && clinics.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-2">
                Preview 
                <Badge variant="secondary" className="text-[10px]">{clinics.length} clinics</Badge>
              </Label>
              <div className="max-h-48 overflow-y-auto rounded-lg border bg-background/50 p-2 space-y-2">
                {clinics.map((clinic, i) => (
                  <div key={clinic.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{clinic.name}</p>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {clinic.rating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                            {clinic.rating}
                          </span>
                        )}
                        {clinic.address && (
                          <span className="truncate">{clinic.address}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loadingClinics && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {/* Insert Button */}
          {selectedCity && clinics && clinics.length > 0 && (
            <Button 
              type="button" 
              onClick={handleInsert}
              className="w-full"
              variant="default"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Insert Top {limit} Dentists {insertAfterIndex === 'end' ? 'at End' : insertAfterIndex === 'start' ? 'at Beginning' : `after Block ${parseInt(insertAfterIndex) + 1}`}
            </Button>
          )}

          {/* No Clinics Message */}
          {selectedCity && !loadingClinics && clinics && clinics.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-2">
              No clinics found in this city. Try selecting a different location.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
