import { useMemo, useState } from 'react';
import { useAdminAreas } from '@/hooks/useAdminLocations';
import { useCities, useStates } from '@/hooks/useLocations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronRight,
  Download,
  Globe,
  Info,
  Loader2,
  MapPin,
  Search,
  Star,
  Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SearchResult {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  reviews_count?: number;
  lat?: number;
  lng?: number;
  already_imported: boolean;
}

export default function GmbBridgeTab() {
  const { data: states } = useStates();
  const [selectedState, setSelectedState] = useState<string>('');

  const { data: cities } = useCities(selectedState || undefined);
  const [selectedCity, setSelectedCity] = useState<string>('');

  const { data: areas } = useAdminAreas(selectedCity || undefined);
  const [selectedArea, setSelectedArea] = useState<string>('');

  const [category, setCategory] = useState('dentist');
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState<string>('');

  const selectedStateMeta = useMemo(
    () => states?.find((s) => s.id === selectedState) ?? null,
    [states, selectedState]
  );

  const selectedCityMeta = useMemo(
    () => cities?.find((c) => c.id === selectedCity) ?? null,
    [cities, selectedCity]
  );

  const selectedAreaMeta = useMemo(
    () => areas?.find((a) => a.id === selectedArea) ?? null,
    [areas, selectedArea]
  );

  // All dental-related categories for comprehensive search
  const allCategories = [
    'dentist',
    'dental clinic',
    'orthodontist',
    'dental surgeon',
    'pediatric dentist',
    'cosmetic dentist',
    'endodontist',
    'periodontist',
    'prosthodontist',
    'oral surgeon',
    'dental office',
    'family dentist',
    'emergency dentist',
  ];

  const categories = [
    { value: 'dentist', label: 'Dentist' },
    { value: 'dental clinic', label: 'Dental Clinic' },
    { value: 'orthodontist', label: 'Orthodontist' },
    { value: 'dental surgeon', label: 'Dental Surgeon' },
    { value: 'pediatric dentist', label: 'Pediatric Dentist' },
    { value: 'cosmetic dentist', label: 'Cosmetic Dentist' },
  ];

  const mergeUniqueByPlaceId = (prev: SearchResult[], next: SearchResult[]) => {
    const map = new Map<string, SearchResult>();
    for (const r of prev) map.set(r.place_id, r);
    for (const r of next) map.set(r.place_id, r);
    return Array.from(map.values());
  };

  const invokeSearch = async (opts: { pageToken?: string } = {}) => {
    if (!selectedState || !selectedCity) {
      throw new Error('Please select a state and city');
    }

    const cityName = selectedCityMeta?.name || '';
    const areaName = selectedAreaMeta?.name || '';

    // Prefer abbreviation if present, otherwise state name
    const stateText =
      (selectedStateMeta as any)?.abbreviation || selectedStateMeta?.name || '';

    const { data, error } = await supabase.functions.invoke('gmb-import', {
      body: {
        action: 'search',
        category,
        city: cityName,
        state: stateText,
        area: areaName,
        pageToken: opts.pageToken,
      },
    });

    if (error) throw error;
    if (data?.requiresSetup) {
      setRequiresSetup(true);
      setSetupError(data?.solution || data?.setupInstructions || null);
      throw new Error(data?.error || 'Google Places API key not configured');
    }
    if (!data?.success) {
      // Check for API key restriction error
      if (data?.error?.includes('referer restrictions') || data?.error?.includes('REQUEST_DENIED')) {
        setRequiresSetup(true);
        setSetupError(data?.solution || 'Your Google API key has HTTP referrer restrictions. Create a new key with NO restrictions or IP restrictions only.');
      }
      throw new Error(data?.error || 'Search failed');
    }

    // Clear setup error on success
    setRequiresSetup(false);
    setSetupError(null);

    return {
      results: (data.results || []) as SearchResult[],
      nextPageToken: (data.next_page_token as string | undefined) || null,
    };
  };

  const handleSearch = async (loadMore = false) => {
    setIsSearching(true);

    try {
      const { results: pageResults, nextPageToken: token } = await invokeSearch({
        pageToken: loadMore ? nextPageToken || undefined : undefined,
      });

      setNextPageToken(token);

      if (loadMore) {
        setResults((prev) => {
          const merged = mergeUniqueByPlaceId(prev, pageResults);
          toast.success(`Fetched ${merged.length} results`);
          return merged;
        });
      } else {
        setResults(pageResults);
        setSelectedPlaces(new Set());
        toast.success(`Fetched ${pageResults.length} results`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      toast.error(message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchAllPages = async () => {
    setIsSearching(true);

    try {
      setResults([]);
      setSelectedPlaces(new Set());
      setNextPageToken(null);

      let token: string | null = null;
      let all: SearchResult[] = [];

      // Fetch all pages for current category (max 3 pages = 60 results per Google API limit)
      for (let page = 0; page < 5; page++) {
        setSearchProgress(`Fetching page ${page + 1}...`);
        const { results: pageResults, nextPageToken: nextToken } = await invokeSearch({
          pageToken: token || undefined,
        });

        all = mergeUniqueByPlaceId(all, pageResults);
        token = nextToken;

        if (!token) break;
      }

      setResults(all);
      setNextPageToken(token);
      setSearchProgress('');
      toast.success(`Fetched ${all.length} results`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      toast.error(message);
      setSearchProgress('');
    } finally {
      setIsSearching(false);
    }
  };

  // Super search: searches ALL categories and ALL areas to maximize results
  const handleSuperSearch = async () => {
    if (!selectedState || !selectedCity) {
      toast.error('Please select a state and city');
      return;
    }

    setIsSearching(true);
    setResults([]);
    setSelectedPlaces(new Set());
    setNextPageToken(null);

    let allResults: SearchResult[] = [];
    const areasToSearch = areas?.length ? areas : [{ id: '', name: '' }]; // Search city-wide if no areas
    const categoriesToSearch = allCategories;

    try {
      let searchCount = 0;
      const totalSearches = categoriesToSearch.length * areasToSearch.length;

      for (const cat of categoriesToSearch) {
        for (const area of areasToSearch) {
          searchCount++;
          setSearchProgress(`Searching "${cat}" in ${area.name || 'city'} (${searchCount}/${totalSearches})...`);

          try {
            const cityName = selectedCityMeta?.name || '';
            const areaName = area.name || '';
            const stateText = (selectedStateMeta as any)?.abbreviation || selectedStateMeta?.name || '';

            let token: string | null = null;

            // Fetch all pages for this category/area combo
            for (let page = 0; page < 3; page++) {
              const { data, error } = await supabase.functions.invoke('gmb-import', {
                body: {
                  action: 'search',
                  category: cat,
                  city: cityName,
                  state: stateText,
                  area: areaName,
                  pageToken: token || undefined,
                },
              });

              if (error) throw error;
              if (data?.requiresSetup) {
                setRequiresSetup(true);
                setSetupError(data?.solution || data?.setupInstructions || null);
                throw new Error(data?.error || 'API key not configured');
              }
              if (!data?.success) {
                if (data?.error?.includes('referer restrictions')) {
                  setRequiresSetup(true);
                  setSetupError(data?.solution || 'Your API key has HTTP referrer restrictions.');
                  throw new Error(data?.error);
                }
                break; // Skip this combo on error
              }

              const pageResults = (data.results || []) as SearchResult[];
              allResults = mergeUniqueByPlaceId(allResults, pageResults);
              token = data.next_page_token || null;

              // Update UI periodically
              if (allResults.length % 50 === 0) {
                setResults([...allResults]);
              }

              if (!token) break;
            }
          } catch (err) {
            // If it's a setup error, rethrow to stop
            if (err instanceof Error && err.message.includes('API key')) throw err;
            // Otherwise continue with next category/area
            console.warn(`Search failed for ${cat} in ${area.name}:`, err);
          }
        }
      }

      setResults(allResults);
      setSearchProgress('');
      toast.success(`Found ${allResults.length} unique dental practices!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      toast.error(message);
      setSearchProgress('');
    } finally {
      setIsSearching(false);
    }
  };

  const chunk = <T,>(arr: T[], size: number) => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  };

  const handleImport = async () => {
    if (selectedPlaces.size === 0) {
      toast.error('Please select places to import');
      return;
    }

    setIsImporting(true);

    const toImport = Array.from(selectedPlaces);
    const batches = chunk(toImport, 50);

    const importedOrDuplicate = new Set<string>();
    let importedTotal = 0;
    let duplicateTotal = 0;
    const allErrors: string[] = [];

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const { data, error } = await supabase.functions.invoke('gmb-import', {
          body: {
            action: 'import',
            placeIds: batch,
            cityId: selectedCity,
            ...(selectedArea ? { areaId: selectedArea } : {}),
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Import failed');

        importedTotal += data.imported || 0;
        duplicateTotal += data.duplicates || 0;

        for (const id of (data.imported_place_ids || []) as string[]) importedOrDuplicate.add(id);
        for (const id of (data.duplicate_place_ids || []) as string[]) importedOrDuplicate.add(id);
        for (const err of (data.errors || []) as string[]) allErrors.push(err);

        toast.success(`Imported batch ${i + 1}/${batches.length}`);
      }

      toast.success(`Imported ${importedTotal} clinics. ${duplicateTotal} duplicates skipped.`);

      // Refresh results to update imported status
      setResults((prev) =>
        prev.map((r) => ({
          ...r,
          already_imported: importedOrDuplicate.has(r.place_id) ? true : r.already_imported,
        }))
      );
      setSelectedPlaces(new Set());

      if (allErrors.length > 0) {
        toast.error(`Some imports failed (${allErrors.length}). Check audit logs for details.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSelect = (placeId: string) => {
    const newSelected = new Set(selectedPlaces);
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId);
    } else {
      newSelected.add(placeId);
    }
    setSelectedPlaces(newSelected);
  };

  const selectAllNew = () => {
    const newPlaces = results.filter(r => !r.already_imported).map(r => r.place_id);
    setSelectedPlaces(new Set(newPlaces));
  };

  const newResultsCount = results.filter(r => !r.already_imported).length;
  const importedCount = results.filter(r => r.already_imported).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Google Bridge</h1>
          <p className="text-muted-foreground mt-1">Import clinics from Google Business Profiles</p>
        </div>
      </div>

      {requiresSetup && (
        <Card className="card-modern border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">API Key Configuration Required</p>
                <p className="text-sm text-muted-foreground">
                  {setupError || 'Please add GOOGLE_PLACES_API_KEY in backend secrets to enable Google import.'}
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
              <p className="font-medium text-foreground">How to fix:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console → Credentials</a></li>
                <li>Create a new API Key (or edit existing)</li>
                <li>Under "Application restrictions", select <strong>"None"</strong> or <strong>"IP addresses"</strong></li>
                <li><strong>Do NOT use "HTTP referrers"</strong> - this doesn't work with server-side API calls</li>
                <li>Under "API restrictions", enable <strong>Places API</strong> and <strong>Maps JavaScript API</strong></li>
                <li>Add the new key to backend secrets as <code className="bg-background px-1 rounded">GOOGLE_PLACES_API_KEY</code></li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google API Limitation Info */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Note:</strong> Google Places API returns max 60 results per search query. 
          Use <strong>"Super Search"</strong> to search across all dental categories (dentist, orthodontist, surgeon, etc.) 
          and all areas to find MORE listings. For large cities, run Super Search multiple times or search specific areas.
        </AlertDescription>
      </Alert>

      {/* Search Progress */}
      {searchProgress && (
        <Alert className="bg-muted border-muted-foreground/20">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <AlertDescription className="text-sm font-medium">{searchProgress}</AlertDescription>
        </Alert>
      )}

      {/* Search Controls */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Select
                value={selectedState}
                onValueChange={(v) => {
                  setSelectedState(v);
                  setSelectedCity('');
                  setSelectedArea('');
                  setResults([]);
                  setSelectedPlaces(new Set());
                  setNextPageToken(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {states?.map((state) => (
                    <SelectItem key={state.id} value={state.id}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Select
                value={selectedCity}
                onValueChange={(v) => {
                  setSelectedCity(v);
                  setSelectedArea('');
                  setResults([]);
                  setSelectedPlaces(new Set());
                  setNextPageToken(null);
                }}
                disabled={!selectedState}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedState ? 'Select city' : 'Select state first'} />
                </SelectTrigger>
                <SelectContent>
                  {cities?.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Area (Optional)</Label>
              <Select
                value={selectedArea || 'all'}
                onValueChange={(v) => setSelectedArea(v === 'all' ? '' : v)}
                disabled={!selectedCity}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {areas?.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2 flex-wrap">
              <Button onClick={() => handleSearch(false)} disabled={isSearching} size="sm">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
              <Button
                variant="outline"
                onClick={handleSearchAllPages}
                disabled={isSearching}
                size="sm"
              >
                <ChevronRight className="h-4 w-4 mr-2" />
                Fetch All Pages
              </Button>
              <Button
                variant="default"
                onClick={handleSuperSearch}
                disabled={isSearching}
                size="sm"
                className="bg-gradient-to-r from-primary to-teal text-white"
              >
                <Zap className="h-4 w-4 mr-2" />
                Super Search (All Categories)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{results.length}</p>
                <p className="text-sm text-muted-foreground">Total Found</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{newResultsCount}</p>
                <p className="text-sm text-muted-foreground">New Listings</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">{importedCount}</p>
                <p className="text-sm text-muted-foreground">Already Imported</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
                <Download className="h-6 w-6 text-blue-custom" />
              </div>
              <div>
                <p className="text-2xl font-bold">{selectedPlaces.size}</p>
                <p className="text-sm text-muted-foreground">Selected</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Search Results</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllNew} disabled={newResultsCount === 0}>
                Select All New ({newResultsCount})
              </Button>
              <Button size="sm" onClick={handleImport} disabled={isImporting || selectedPlaces.size === 0}>
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Import Selected ({selectedPlaces.size})
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.place_id} className={result.already_imported ? 'opacity-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPlaces.has(result.place_id)}
                        onCheckedChange={() => toggleSelect(result.place_id)}
                        disabled={result.already_imported}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{result.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate max-w-64">{result.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-gold text-gold" />
                          <span className="font-medium">{result.rating.toFixed(1)}</span>
                          <span className="text-muted-foreground text-sm">({result.reviews_count || 0})</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.already_imported ? (
                        <Badge variant="secondary">Already Imported</Badge>
                      ) : (
                        <Badge className="bg-teal/20 text-teal">New</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          {nextPageToken && (
            <div className="p-4 border-t flex justify-center">
              <Button variant="outline" onClick={() => handleSearch(true)} disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                Load More Results
              </Button>
            </div>
          )}
        </Card>
      )}

      {results.length === 0 && !isSearching && (
        <Card className="card-modern">
          <CardContent className="p-12 text-center">
            <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
            <p className="text-muted-foreground">Select a category and location, then click Search to find businesses</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
