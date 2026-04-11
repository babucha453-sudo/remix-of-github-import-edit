import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ACTIVE_STATE_SLUGS } from '@/lib/constants/activeStates';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Download,
  Globe,
  Loader2,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Zap,
  CheckSquare,
  Square,
  Database,
  Trash2,
  WifiOff,
  Wifi,
  Settings2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface SearchResult {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  reviews_count?: number;
  lat?: number;
  lng?: number;
  city_id?: string;
  city_name?: string;
  category?: string;
  already_imported: boolean;
  import_status?: 'pending' | 'importing' | 'imported' | 'duplicate' | 'error';
}

interface LogEntry {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface ScraperSession {
  id: string;
  state_name: string;
  status: string;
  total_found: number;
  imported_count: number;
  duplicate_count: number;
  created_at: string;
}

const ALL_CATEGORIES = [
  { id: 'dentist', label: 'Dentist' },
  { id: 'dental clinic', label: 'Dental Clinic' },
  { id: 'orthodontist', label: 'Orthodontist' },
  { id: 'dental surgeon', label: 'Dental Surgeon' },
  { id: 'pediatric dentist', label: 'Pediatric Dentist' },
  { id: 'cosmetic dentist', label: 'Cosmetic Dentist' },
  { id: 'endodontist', label: 'Endodontist' },
  { id: 'periodontist', label: 'Periodontist' },
  { id: 'prosthodontist', label: 'Prosthodontist' },
  { id: 'oral surgeon', label: 'Oral Surgeon' },
  { id: 'dental office', label: 'Dental Office' },
  { id: 'family dentist', label: 'Family Dentist' },
  { id: 'emergency dentist', label: 'Emergency Dentist' },
];

export default function GmbScraperBotTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State selection - NOW SUPPORTS MULTIPLE STATES (active states only)
  const { data: states } = useQuery({
    queryKey: ['states-active'],
    queryFn: async () => {
      const { data } = await supabase.from('states').select('*').eq('is_active', true).in('slug', ACTIVE_STATE_SLUGS).order('name');
      return data || [];
    },
  });
  
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['dentist', 'dental clinic']);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // NEW: Filter options for cities
  const [cityFilter, setCityFilter] = useState<'all' | 'empty' | 'with-dentists'>('all');
  const [maxPagesPerSearch, setMaxPagesPerSearch] = useState<number>(5); // Support pagination beyond 20
  
  // Fetch cities for ALL selected states with dentist counts
  const { data: cities } = useQuery({
    queryKey: ['cities-for-states', selectedStateIds],
    queryFn: async () => {
      if (selectedStateIds.length === 0) return [];
      const { data } = await supabase
        .from('cities')
        .select('*, state:states(id, name, abbreviation)')
        .in('state_id', selectedStateIds)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: selectedStateIds.length > 0,
  });
  
  // Apply city filter
  const filteredCities = useMemo(() => {
    if (!cities) return [];
    switch (cityFilter) {
      case 'empty':
        return cities.filter(c => (c.dentist_count ?? 0) === 0);
      case 'with-dentists':
        return cities.filter(c => (c.dentist_count ?? 0) > 0);
      default:
        return cities;
    }
  }, [cities, cityFilter]);
  
  // Fetch existing sessions
  const { data: sessions } = useQuery({
    queryKey: ['gmb-scraper-sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('gmb_scraper_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as ScraperSession[];
    },
  });
  
  // Fetch results for active session
  const { data: sessionResults, refetch: refetchResults } = useQuery({
    queryKey: ['gmb-scraper-results', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      const { data } = await supabase
        .from('gmb_scraper_results')
        .select('*')
        .eq('session_id', activeSessionId)
        .order('name');
      return (data || []).map((r: any) => ({
        place_id: r.place_id,
        name: r.name,
        address: r.address,
        rating: r.rating,
        reviews_count: r.reviews_count,
        lat: r.lat,
        lng: r.lng,
        city_id: r.city_id,
        city_name: r.city_name,
        category: r.category,
        already_imported: r.import_status === 'imported' || r.import_status === 'duplicate',
        import_status: r.import_status,
      })) as SearchResult[];
    },
    enabled: !!activeSessionId,
    refetchInterval: activeSessionId ? 3000 : false,
  });
  
  // Bot state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, city: '', phase: '' });
  const [stats, setStats] = useState({ totalFound: 0, newFound: 0, imported: 0, duplicates: 0, errors: 0 });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentCity, setCurrentCity] = useState<string>('');
  const [currentRunState, setCurrentRunState] = useState<string>('');

  const abortRef = useRef(false);
  const pausedRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Each run gets a unique incrementing key. If a second run starts, the old run MUST stop
  // (this prevents "stop" then "start" from accidentally resuming the old loop).
  const runKeyRef = useRef(0);
  const newRunKey = () => ++runKeyRef.current;
  const isRunCancelled = (runKey: number) => abortRef.current || runKeyRef.current !== runKey;
  const cancelRun = () => {
    abortRef.current = true;
    runKeyRef.current += 1; // invalidate any in-flight loops even if abortRef gets reset later
    pausedRef.current = false;
  };
  const selectedStates = states?.filter(s => selectedStateIds.includes(s.id)) || [];
  const selectedCities = cities?.filter(c => selectedCityIds.includes(c.id)) || [];
  
  // Toggle state selection (multi-select)
  const toggleState = (stateId: string) => {
    setSelectedStateIds(prev => 
      prev.includes(stateId) 
        ? prev.filter(id => id !== stateId)
        : [...prev, stateId]
    );
  };
  
  const toggleSelectAllStates = () => {
    if (selectedStateIds.length === states?.length) {
      setSelectedStateIds([]);
    } else {
      setSelectedStateIds(states?.map(s => s.id) || []);
    }
  };
  
  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addLog('success', '🌐 Connection restored - resuming...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      addLog('warning', '⚠️ Connection lost - waiting for reconnection...');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Load session results when active session changes
  useEffect(() => {
    if (sessionResults && sessionResults.length > 0) {
      setResults(sessionResults);
      const pendingCount = sessionResults.filter(r => r.import_status === 'pending').length;
      const importedCount = sessionResults.filter(r => r.import_status === 'imported').length;
      const dupCount = sessionResults.filter(r => r.import_status === 'duplicate').length;
      const errorCount = sessionResults.filter(r => r.import_status === 'error').length;
      setStats({
        totalFound: sessionResults.length,
        newFound: pendingCount,
        imported: importedCount,
        duplicates: dupCount,
        errors: errorCount,
      });
    }
  }, [sessionResults]);
  
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  // Reset city selection when states change
  useEffect(() => {
    setSelectedCityIds([]);
  }, [selectedStateIds.length]);
  
  // Sync pausedRef with isPaused state
  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);
  
  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev.slice(-500), { timestamp: new Date(), type, message }]);
  }, []);
  
  const mergeUnique = (prev: SearchResult[], next: SearchResult[]) => {
    const map = new Map<string, SearchResult>();
    for (const r of prev) map.set(r.place_id, r);
    for (const r of next) map.set(r.place_id, r);
    return Array.from(map.values());
  };
  
  const toggleSelectAllCities = () => {
    if (selectedCityIds.length === filteredCities?.length) {
      setSelectedCityIds([]);
    } else {
      setSelectedCityIds(filteredCities?.map(c => c.id) || []);
    }
  };
  
  const toggleCity = (cityId: string) => {
    setSelectedCityIds(prev => 
      prev.includes(cityId) 
        ? prev.filter(id => id !== cityId)
        : [...prev, cityId]
    );
  };
  
  const toggleSelectAllCategories = () => {
    if (selectedCategories.length === ALL_CATEGORIES.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(ALL_CATEGORIES.map(c => c.id));
    }
  };
  
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };
  
  // Wait for network with exponential backoff
  const waitForNetwork = async (maxWaitMs = 300000): Promise<boolean> => {
    const startTime = Date.now();
    let delay = 1000;
    
    while (!navigator.onLine && Date.now() - startTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 10000);
    }
    
    return navigator.onLine;
  };
  
  // Retry function with network awareness + hard cancellation
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    runKey: number,
    maxRetries = 5,
    initialDelay = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (isRunCancelled(runKey)) {
        throw new Error('Operation cancelled');
      }

      // Wait for network if offline
      if (!navigator.onLine) {
        addLog('warning', '⏳ Waiting for network connection...');
        const online = await waitForNetwork();
        if (!online) {
          throw new Error('Network timeout - please check your connection');
        }
      }

      // Wait while paused
      while (pausedRef.current && !isRunCancelled(runKey)) {
        await new Promise((r) => setTimeout(r, 500));
      }

      if (isRunCancelled(runKey)) {
        throw new Error('Operation cancelled');
      }

      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (isRunCancelled(runKey)) {
          throw new Error('Operation cancelled');
        }

        if (attempt < maxRetries - 1) {
          addLog('warning', `⚠️ Retry ${attempt + 1}/${maxRetries} in ${delay / 1000}s: ${lastError.message}`);
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 2, 30000);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  };
  
  // Search a city for all categories
  const searchCity = async (
    cityName: string,
    cityId: string,
    stateText: string,
    categories: string[],
    runKey: number
  ): Promise<SearchResult[]> => {
    const allResults: SearchResult[] = [];

    for (const category of categories) {
      if (isRunCancelled(runKey)) break;

      while (pausedRef.current && !isRunCancelled(runKey)) {
        await new Promise((r) => setTimeout(r, 500));
      }

      let pageToken: string | null = null;
      const seenPlaceIds = new Set<string>(); // Track seen results to avoid duplicates across pages

      // Fetch all pages for this category - now uses maxPagesPerSearch
      for (let page = 0; page < maxPagesPerSearch; page++) {
        if (isRunCancelled(runKey)) break;

        try {
          const data = await retryWithBackoff(async () => {
            const { data, error } = await supabase.functions.invoke('gmb-import', {
              body: {
                action: 'search',
                category,
                city: cityName,
                state: stateText,
                area: '',
                pageToken: pageToken || undefined,
              },
            });

            if (error) throw error;
            if (!data?.success) {
              if (data?.requiresSetup) throw new Error('API key not configured');
              return { results: [], next_page_token: null };
            }
            return data;
          }, runKey);

          const pageResults = (data.results || []).map((r: any) => ({
            ...r,
            city_id: cityId,
            city_name: cityName,
            category,
            import_status: r.already_imported ? 'duplicate' : 'pending',
          })) as SearchResult[];

          allResults.push(...pageResults);
          pageToken = data.next_page_token || null;

          if (!pageToken) break;

          // Google requires delay for page tokens
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err) {
          if (isRunCancelled(runKey)) break;
          addLog('error', `  ✗ ${category}: ${err instanceof Error ? err.message : 'Failed'}`);
          break;
        }
      }

      if (allResults.length > 0) {
        addLog('success', `  ✓ ${category}: ${allResults.filter((r) => r.category === category).length} found`);
      }

      // Small delay between categories
      await new Promise((r) => setTimeout(r, 200));
    }

    return allResults;
  };
  
  // Import a single place with retry
  const importSinglePlace = async (
    placeId: string,
    cityId: string,
    sessionId: string,
    runKey: number
  ): Promise<{ imported: boolean; duplicate: boolean; error?: string }> => {
    try {
      const data = await retryWithBackoff(async () => {
        const { data, error } = await supabase.functions.invoke('gmb-import', {
          body: {
            action: 'import',
            placeIds: [placeId],
            cityId,
            sessionId,
          },
        });

        if (error) throw error;
        return data;
      }, runKey, 3, 500);

      if (data?.success) {
        return {
          imported: (data.imported || 0) > 0,
          duplicate: (data.duplicates || 0) > 0,
        };
      }

      return { imported: false, duplicate: false, error: data?.error || 'Import failed' };
    } catch (err) {
      return {
        imported: false,
        duplicate: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };
  
  // Save results to database
  const saveResultsToDb = async (sessionId: string, resultsToSave: SearchResult[]) => {
    if (resultsToSave.length === 0) return;
    
    const records = resultsToSave.map(r => ({
      session_id: sessionId,
      place_id: r.place_id,
      name: r.name,
      address: r.address,
      rating: r.rating,
      reviews_count: r.reviews_count,
      lat: r.lat,
      lng: r.lng,
      city_id: r.city_id,
      city_name: r.city_name,
      category: r.category,
      import_status: r.import_status || 'pending',
    }));
    
    // Insert in batches
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      await supabase.from('gmb_scraper_results').upsert(batch, { 
        onConflict: 'session_id,place_id',
        ignoreDuplicates: true 
      });
    }
  };
  
  // Update session stats
  const updateSessionStats = async (sessionId: string, stats: { imported?: number; duplicates?: number; errors?: number; total?: number }) => {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (stats.imported !== undefined) updates.imported_count = stats.imported;
    if (stats.duplicates !== undefined) updates.duplicate_count = stats.duplicates;
    if (stats.errors !== undefined) updates.error_count = stats.errors;
    if (stats.total !== undefined) updates.total_found = stats.total;
    
    await supabase
      .from('gmb_scraper_sessions')
      .update(updates)
      .eq('id', sessionId);
  };
  
  // Main bot runner - searches and imports city by city
  const runBot = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }
    
    if (selectedStateIds.length === 0 || selectedCityIds.length === 0) {
      toast.error('Please select at least one state and city');
      return;
    }
    
    if (selectedCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }
    
    // Get state names for display
    const stateNames = selectedStates.map(s => s.name).join(', ');
    
    // Create session - store first state for backward compat, but we track all
    const { data: session, error: sessionError } = await supabase
      .from('gmb_scraper_sessions')
      .insert({
        user_id: user.id,
        state_id: selectedStateIds[0], // First state for backward compat
        state_name: stateNames,
        city_ids: selectedCityIds,
        categories: selectedCategories,
        status: 'running',
      })
      .select()
      .single();
    
    if (sessionError || !session) {
      toast.error('Failed to create session');
      console.error(sessionError);
      return;
    }
    
    setActiveSessionId(session.id);
    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    pausedRef.current = false;
    setLogs([]);
    setResults([]);
    setStats({ totalFound: 0, newFound: 0, imported: 0, duplicates: 0, errors: 0 });

    // Create a unique run key for this run - allows hard cancellation
    const runKey = newRunKey();
    setCurrentRunState(stateNames);

    const citiesToScan = [...selectedCities];
    
    addLog('info', `🤖 Starting bot for ${stateNames}`);
    addLog('info', `📊 ${citiesToScan.length} cities, ${selectedCategories.length} categories`);
    addLog('info', `💾 Auto-save enabled - progress persists even if connection drops`);
    addLog('info', `📍 Using precise lat/lng matching for accurate city assignment`);
    
    let totalImported = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    let totalFound = 0;
    
    for (let cityIndex = 0; cityIndex < citiesToScan.length; cityIndex++) {
      const city = citiesToScan[cityIndex];

      if (isRunCancelled(runKey)) {
        addLog('warning', '⛔ Bot stopped by user');
        break;
      }

      // Wait while paused
      while (pausedRef.current && !isRunCancelled(runKey)) {
        await new Promise((r) => setTimeout(r, 500));
      }

      if (isRunCancelled(runKey)) break;

      setCurrentCity(city.name);
      setProgress({
        current: cityIndex + 1,
        total: citiesToScan.length,
        city: city.name,
        phase: 'Searching',
      });
      
      addLog('info', `\n📍 [${cityIndex + 1}/${citiesToScan.length}] ${city.name}`);
      addLog('info', `  🔍 Searching...`);
      
      // PHASE 1: Search this city - use state abbreviation from the city's linked state
      const cityState = (city as any).state as { abbreviation?: string; name?: string } | undefined;
      const stateAbbrev = cityState?.abbreviation || cityState?.name || '';
      const cityResults = await searchCity(city.name, city.id, stateAbbrev, selectedCategories, runKey);
      
      // Deduplicate
      const uniqueResults = cityResults.reduce((acc, r) => {
        if (!acc.find(x => x.place_id === r.place_id)) acc.push(r);
        return acc;
      }, [] as SearchResult[]);
      
      const newListings = uniqueResults.filter(r => r.import_status === 'pending');
      totalFound += uniqueResults.length;
      
      addLog('success', `  📊 Found ${uniqueResults.length} total, ${newListings.length} new`);
      
      // Save search results to DB immediately
      await saveResultsToDb(session.id, uniqueResults);
      
      // Update local state
      setResults(prev => mergeUnique(prev, uniqueResults));
      
      if (newListings.length === 0) {
        addLog('info', `  ⏭️ No new listings to import, moving to next city`);
        continue;
      }
      
      // PHASE 2: Import this city's listings one by one
      setProgress(prev => ({ ...prev, phase: 'Importing' }));
      addLog('info', `  ⬇️ Importing ${newListings.length} listings...`);
      
      let cityImported = 0;
      let cityDuplicates = 0;
      let cityErrors = 0;
      
      for (let i = 0; i < newListings.length; i++) {
        if (isRunCancelled(runKey)) break;

        while (pausedRef.current && !isRunCancelled(runKey)) {
          await new Promise((r) => setTimeout(r, 500));
        }

        if (isRunCancelled(runKey)) break;

        const listing = newListings[i];
        
        // Update status to importing
        await supabase
          .from('gmb_scraper_results')
          .update({ import_status: 'importing' })
          .eq('session_id', session.id)
          .eq('place_id', listing.place_id);
        
        const result = await importSinglePlace(listing.place_id, city.id, session.id, runKey);
        
        if (result.imported) {
          cityImported++;
          await supabase
            .from('gmb_scraper_results')
            .update({ import_status: 'imported' })
            .eq('session_id', session.id)
            .eq('place_id', listing.place_id);
        } else if (result.duplicate) {
          cityDuplicates++;
          await supabase
            .from('gmb_scraper_results')
            .update({ import_status: 'duplicate' })
            .eq('session_id', session.id)
            .eq('place_id', listing.place_id);
        } else {
          cityErrors++;
          await supabase
            .from('gmb_scraper_results')
            .update({ import_status: 'error', error_message: result.error })
            .eq('session_id', session.id)
            .eq('place_id', listing.place_id);
        }
        
        // Update stats every 10 imports
        if ((i + 1) % 10 === 0 || i === newListings.length - 1) {
          totalImported += cityImported;
          totalDuplicates += cityDuplicates;
          totalErrors += cityErrors;
          
          setStats({
            totalFound,
            newFound: totalFound - totalImported - totalDuplicates,
            imported: totalImported,
            duplicates: totalDuplicates,
            errors: totalErrors,
          });
          
          await updateSessionStats(session.id, {
            total: totalFound,
            imported: totalImported,
            duplicates: totalDuplicates,
            errors: totalErrors,
          });
          
          // Reset city counters (they've been added to totals)
          cityImported = 0;
          cityDuplicates = 0;
          cityErrors = 0;
          
          addLog('info', `    📈 Progress: ${i + 1}/${newListings.length} processed`);
        }
        
        // Small delay between imports
        await new Promise(r => setTimeout(r, 100));
      }
      
      addLog('success', `  ✅ ${city.name} complete!`);
      
      // Refresh results from DB
      refetchResults();
    }
    
    // Final session update
    await supabase
      .from('gmb_scraper_sessions')
      .update({
        status: isRunCancelled(runKey) ? 'cancelled' : 'completed',
        total_found: totalFound,
        imported_count: totalImported,
        duplicate_count: totalDuplicates,
        error_count: totalErrors,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);
    
    queryClient.invalidateQueries({ queryKey: ['gmb-scraper-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['clinics'] });
    
    addLog('success', `\n🎉 Bot completed!`);
    addLog('success', `   Total found: ${totalFound}`);
    addLog('success', `   Imported: ${totalImported}`);
    addLog('success', `   Duplicates: ${totalDuplicates}`);
    addLog('success', `   Errors: ${totalErrors}`);
    
    setIsRunning(false);
    setCurrentCity('');
    const completedStateNames = selectedStates.map(s => s.name).join(', ') || 'selected states';
    toast.success(`Imported ${totalImported} clinics from ${completedStateNames}!`);
  };
  
  // Resume importing pending items from a session
  const resumeImport = async () => {
    if (!activeSessionId) {
      toast.error('No session selected');
      return;
    }
    
    const pendingResults = results.filter(r => r.import_status === 'pending');
    
    if (pendingResults.length === 0) {
      toast.info('No pending listings to import');
      return;
    }
    
    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    pausedRef.current = false;

    // Create a unique run key for cancellation
    const runKey = newRunKey();

    addLog('info', `▶️ Resuming import of ${pendingResults.length} pending listings...`);

    // Group by city
    const byCity = new Map<string, SearchResult[]>();
    for (const r of pendingResults) {
      const key = r.city_id || 'unknown';
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key)!.push(r);
    }

    let imported = stats.imported;
    let duplicates = stats.duplicates;
    let errors = stats.errors;

    for (const [cityId, cityResults] of byCity) {
      if (isRunCancelled(runKey)) break;

      const cityName = cityResults[0]?.city_name || 'Unknown';
      addLog('info', `📍 Processing ${cityName} (${cityResults.length} pending)...`);

      for (const listing of cityResults) {
        if (isRunCancelled(runKey)) break;

        while (pausedRef.current && !isRunCancelled(runKey)) {
          await new Promise((r) => setTimeout(r, 500));
        }

        if (isRunCancelled(runKey)) break;

        await supabase
          .from('gmb_scraper_results')
          .update({ import_status: 'importing' })
          .eq('session_id', activeSessionId)
          .eq('place_id', listing.place_id);

        const result = await importSinglePlace(listing.place_id, cityId, activeSessionId, runKey);
        
        if (result.imported) {
          imported++;
          await supabase
            .from('gmb_scraper_results')
            .update({ import_status: 'imported' })
            .eq('session_id', activeSessionId)
            .eq('place_id', listing.place_id);
        } else if (result.duplicate) {
          duplicates++;
          await supabase
            .from('gmb_scraper_results')
            .update({ import_status: 'duplicate' })
            .eq('session_id', activeSessionId)
            .eq('place_id', listing.place_id);
        } else {
          errors++;
          await supabase
            .from('gmb_scraper_results')
            .update({ import_status: 'error', error_message: result.error })
            .eq('session_id', activeSessionId)
            .eq('place_id', listing.place_id);
        }
        
        setStats({
          totalFound: stats.totalFound,
          newFound: stats.totalFound - imported - duplicates,
          imported,
          duplicates,
          errors,
        });
        
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    await updateSessionStats(activeSessionId, { imported, duplicates, errors });
    
    queryClient.invalidateQueries({ queryKey: ['gmb-scraper-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['clinics'] });
    refetchResults();
    
    addLog('success', `✅ Resume complete! Imported: ${imported}, Duplicates: ${duplicates}, Errors: ${errors}`);
    setIsRunning(false);
    toast.success('Import resumed and completed!');
  };
  
  const loadSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setLogs([]);
    addLog('info', `📂 Loading session ${sessionId.slice(0, 8)}...`);
    
    const session = sessions?.find(s => s.id === sessionId);
    if (session) {
      addLog('success', `✓ Loaded ${session.state_name} session with ${session.total_found} results`);
      addLog('info', `   Imported: ${session.imported_count}, Duplicates: ${session.duplicate_count}`);
    }
  };
  
  const deleteSession = async (sessionId: string) => {
    // Confirm before delete
    if (!window.confirm('Are you sure you want to delete this session and all its results? This action cannot be undone.')) {
      return;
    }

    // Stop any running bot immediately if it's this session
    if (activeSessionId === sessionId && isRunning) {
      cancelRun();
      setIsRunning(false);
      setIsPaused(false);
      addLog('warning', '⛔ Session deleted - bot stopped');
    }

    try {
      // Delete results first (foreign key constraint)
      const { error: resultsError } = await supabase
        .from('gmb_scraper_results')
        .delete()
        .eq('session_id', sessionId);
      
      if (resultsError) {
        console.error('Error deleting results:', resultsError);
        throw resultsError;
      }

      // Then delete session
      const { error: sessionError } = await supabase
        .from('gmb_scraper_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (sessionError) {
        console.error('Error deleting session:', sessionError);
        throw sessionError;
      }

      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setResults([]);
      }

      queryClient.invalidateQueries({ queryKey: ['gmb-scraper-sessions'] });
      toast.success('Session deleted successfully');
    } catch (error: any) {
      console.error('Delete session error:', error);
      toast.error(`Failed to delete session: ${error.message || 'Unknown error'}`);
    }
  };

  const stopBot = () => {
    cancelRun();
    setIsRunning(false);
    setIsPaused(false);
    setCurrentRunState('');
    addLog('warning', '⛔ Bot stopped by user');
  };
  
  const togglePause = () => {
    setIsPaused(p => {
      pausedRef.current = !p;
      if (!p) {
        addLog('info', '⏸️ Paused - click Resume to continue');
      } else {
        addLog('info', '▶️ Resuming...');
      }
      return !p;
    });
  };
  
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const pendingCount = results.filter(r => r.import_status === 'pending').length;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            GMB Scraper Bot
          </h1>
          <p className="text-muted-foreground mt-1">
            Search and import dentists city-by-city with auto-save
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && currentRunState && (
            <Badge variant="default" className="text-sm px-3 py-1 bg-primary animate-pulse">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Scraping: {currentRunState} / {currentCity || 'Starting...'}
            </Badge>
          )}
          {isOnline ? (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Wifi className="h-3 w-3 mr-1" />
              Online
            </Badge>
          ) : (
            <Badge variant="destructive">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Sparkles className="h-4 w-4 mr-2" />
            Auto-Import
          </Badge>
        </div>
      </div>
      
      {/* Previous Sessions */}
      {sessions && sessions.length > 0 && (
        <Card className="card-modern">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              Previous Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sessions.map(session => (
                <div key={session.id} className="flex items-center gap-1">
                  <Button
                    variant={activeSessionId === session.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => loadSession(session.id)}
                    className="gap-2"
                  >
                    <MapPin className="h-3 w-3" />
                    {session.state_name} ({session.total_found})
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {session.imported_count}/{session.total_found}
                    </Badge>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      deleteSession(session.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Configuration */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* State & Cities */}
        <Card className="card-modern lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select States ({selectedStateIds.length} of {states?.length || 0})</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAllStates}
                  disabled={isRunning}
                  className="gap-2"
                >
                  {selectedStateIds.length === states?.length ? (
                    <><Square className="h-4 w-4" /> Deselect All</>
                  ) : (
                    <><CheckSquare className="h-4 w-4" /> Select All</>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 p-3 border rounded-xl bg-muted/20">
                {states?.map(state => (
                  <div
                    key={state.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedStateIds.includes(state.id)
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => !isRunning && toggleState(state.id)}
                  >
                    <Checkbox
                      checked={selectedStateIds.includes(state.id)}
                      disabled={isRunning}
                      onCheckedChange={() => toggleState(state.id)}
                    />
                    <span className="text-sm font-medium">{state.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(state as any).abbreviation || ''}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            
            {cities && cities.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Label>Cities ({selectedCityIds.length} of {filteredCities.length})</Label>
                    {/* City Filter Dropdown */}
                    <Select value={cityFilter} onValueChange={(v) => setCityFilter(v as any)} disabled={isRunning}>
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Cities ({cities.length})</SelectItem>
                        <SelectItem value="empty">
                          🔴 Empty - No Dentists ({cities.filter(c => (c.dentist_count ?? 0) === 0).length})
                        </SelectItem>
                        <SelectItem value="with-dentists">
                          🟢 With Dentists ({cities.filter(c => (c.dentist_count ?? 0) > 0).length})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAllCities}
                    disabled={isRunning}
                    className="gap-2"
                  >
                    {selectedCityIds.length === filteredCities.length && filteredCities.length > 0 ? (
                      <><Square className="h-4 w-4" /> Deselect All</>
                    ) : (
                      <><CheckSquare className="h-4 w-4" /> Select All</>
                    )}
                  </Button>
                </div>
                
                {cityFilter === 'empty' && filteredCities.length > 0 && (
                  <Alert className="bg-amber-500/10 border-amber-500/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-sm">
                      Showing {filteredCities.length} cities with zero dentists. Select these to scrape and populate them.
                    </AlertDescription>
                  </Alert>
                )}
                
                <ScrollArea className="h-48 border rounded-xl p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {filteredCities.map(city => (
                      <div
                        key={city.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedCityIds.includes(city.id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => !isRunning && toggleCity(city.id)}
                      >
                        <Checkbox
                          checked={selectedCityIds.includes(city.id)}
                          disabled={isRunning}
                          onCheckedChange={() => toggleCity(city.id)}
                        />
                        <span className="text-sm truncate">{city.name}</span>
                        <Badge 
                          variant={(city.dentist_count ?? 0) === 0 ? "destructive" : "secondary"} 
                          className="text-xs ml-auto"
                        >
                          {city.dentist_count ?? 0}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Categories */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">
                {selectedCategories.length} of {ALL_CATEGORIES.length}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAllCategories}
                disabled={isRunning}
                className="gap-2"
              >
                {selectedCategories.length === ALL_CATEGORIES.length ? (
                  <><Square className="h-4 w-4" /> None</>
                ) : (
                  <><CheckSquare className="h-4 w-4" /> All</>
                )}
              </Button>
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {ALL_CATEGORIES.map(cat => (
                  <div
                    key={cat.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedCategories.includes(cat.id)
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => !isRunning && toggleCategory(cat.id)}
                  >
                    <Checkbox
                      checked={selectedCategories.includes(cat.id)}
                      disabled={isRunning}
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    <span className="text-sm">{cat.label}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      
      {/* Controls & Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Controls */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg">Bot Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {!isRunning ? (
                <>
                  <Button
                    onClick={runBot}
                    disabled={selectedCityIds.length === 0 || selectedCategories.length === 0}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start New Search
                  </Button>
                  
                  {activeSessionId && pendingCount > 0 && (
                    <Button
                      onClick={resumeImport}
                      variant="outline"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Resume Import ({pendingCount})
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={togglePause}
                    variant="outline"
                    className="gap-2"
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    onClick={stopBot}
                    variant="destructive"
                    className="gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}
            </div>
            
            {/* Advanced Pagination Settings */}
            {!isRunning && (
              <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Pagination Settings</Label>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Max pages per category</span>
                    <span className="font-medium">{maxPagesPerSearch} pages ({maxPagesPerSearch * 20} results max)</span>
                  </div>
                  <Slider
                    value={[maxPagesPerSearch]}
                    onValueChange={([val]) => setMaxPagesPerSearch(val)}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Google limits 20 results per page. Increase to search beyond the initial results.
                  </p>
                </div>
              </div>
            )}
            
            {isRunning && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{progress.phase}: {currentCity || progress.city}</span>
                  <span>City {progress.current}/{progress.total}</span>
                </div>
                <Progress value={progressPercent} />
                {isPaused && (
                  <Badge variant="outline" className="text-amber-600">
                    <Pause className="h-3 w-3 mr-1" /> Paused
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Stats */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-muted/30 rounded-xl text-center">
                <div className="text-2xl font-bold">{stats.totalFound}</div>
                <div className="text-xs text-muted-foreground">Found</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-600">{stats.imported}</div>
                <div className="text-xs text-muted-foreground">Imported</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.newFound}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl text-center">
                <div className="text-2xl font-bold text-amber-600">{stats.duplicates}</div>
                <div className="text-xs text-muted-foreground">Duplicates</div>
              </div>
              <div className="p-3 bg-red-500/10 rounded-xl text-center">
                <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.totalFound > 0 ? Math.round((stats.imported / stats.totalFound) * 100) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Logs & Results */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity Log */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 border rounded-xl p-3 bg-muted/20">
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No activity yet. Start the bot to begin.
                </div>
              ) : (
                <div className="space-y-1 font-mono text-sm">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 ${
                        log.type === 'error' ? 'text-red-500' :
                        log.type === 'warning' ? 'text-amber-500' :
                        log.type === 'success' ? 'text-green-500' :
                        'text-muted-foreground'
                      }`}
                    >
                      <span className="text-xs opacity-50 shrink-0">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="whitespace-pre-wrap">{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Results Preview */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Listings ({results.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 border rounded-xl">
              {results.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                  No listings yet. Start a search or load a session.
                </div>
              ) : (
                <div className="divide-y">
                  {results.slice(0, 100).map((result) => (
                    <div
                      key={result.place_id}
                      className={`p-3 ${
                        result.import_status === 'imported' ? 'bg-green-500/5' :
                        result.import_status === 'duplicate' ? 'bg-amber-500/5' :
                        result.import_status === 'error' ? 'bg-red-500/5' :
                        result.import_status === 'importing' ? 'bg-blue-500/5' :
                        ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{result.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {result.address}
                          </div>
                          {result.city_name && (
                            <div className="text-xs text-primary">{result.city_name}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {result.rating && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {result.rating}
                            </Badge>
                          )}
                          {result.import_status === 'imported' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : result.import_status === 'duplicate' ? (
                            <Badge variant="outline" className="text-amber-600 text-xs">Dup</Badge>
                          ) : result.import_status === 'error' ? (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          ) : result.import_status === 'importing' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          ) : (
                            <Badge variant="outline" className="text-blue-600 text-xs">New</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {results.length > 100 && (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      ... and {results.length - 100} more
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      
      {/* Info */}
      <Alert>
        <Zap className="h-4 w-4" />
        <AlertDescription>
          <strong>Smart Multi-State Import:</strong> Select multiple states and cities in one run. The bot uses precise GPS coordinates (lat/lng) 
          to assign each dentist to their exact city - not nearby areas. Progress is auto-saved continuously, so you can pause/stop anytime 
          and resume later. The bot will wait for network reconnection if connection drops.
        </AlertDescription>
      </Alert>
    </div>
  );
}