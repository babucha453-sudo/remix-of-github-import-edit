import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ACTIVE_STATE_SLUGS, isPageInActiveState } from '@/lib/constants/activeStates';
import { 
  Search, Filter, CheckCircle, XCircle, AlertTriangle, Eye, ExternalLink,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface SeoPage {
  id: string;
  slug: string;
  page_type: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  content: string | null;
  word_count: number | null;
  seo_score: number | null;
  is_thin_content: boolean | null;
  is_duplicate: boolean | null;
  is_optimized: boolean | null;
  needs_optimization: boolean | null;
  last_audited_at: string | null;
}

export interface SeoPagePickerProps {
  selectedPages: string[];
  onSelectionChange: (pageIds: string[]) => void;
  onInspectPage?: (page: SeoPage) => void;
}

const PAGE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Page Types' },
  { value: 'state', label: 'State Pages' },
  { value: 'city', label: 'City Pages' },
  { value: 'city_treatment', label: 'Service + Location' },
  { value: 'treatment', label: 'Service Pages' },
  { value: 'clinic', label: 'Clinic Profiles' },
  { value: 'dentist', label: 'Dentist Profiles' },
  { value: 'blog', label: 'Blog Posts' },
  { value: 'static', label: 'Static Pages' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'missing_meta', label: 'Missing Meta' },
  { value: 'missing_h1', label: 'Missing H1' },
  { value: 'thin_content', label: 'Thin Content (<300 words)' },
  { value: 'no_content', label: 'No Content' },
  { value: 'duplicate', label: 'Duplicate Content' },
  { value: 'low_score', label: 'Low SEO Score (<50)' },
  { value: 'needs_optimization', label: 'Needs Optimization' },
  { value: 'optimized', label: 'Already Optimized' },
];

const ITEMS_PER_PAGE = 50;

export function SeoPagePicker({ selectedPages, onSelectionChange, onInspectPage }: SeoPagePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pageType, setPageType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch all SEO pages
  const { data: allPages, isLoading } = useQuery({
    queryKey: ['seo-pages-picker'],
    queryFn: async () => {
      const pageSize = 1000;
      const all: SeoPage[] = [];
      let from = 0;
      
      while (true) {
        const { data, error } = await supabase
          .from('seo_pages')
          .select('*')
          .order('slug', { ascending: true })
          .range(from, from + pageSize - 1);
        
        if (error) throw error;
        const batch = (data || []) as unknown as SeoPage[];
        // Filter to only pages in active states
        const filtered = batch.filter(page => isPageInActiveState(page.slug, page.page_type));
        all.push(...filtered);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      
      return all;
    },
  });

  // Fetch states and cities for filtering (active states only)
  const { data: filterOptions } = useQuery({
    queryKey: ['seo-filter-options'],
    queryFn: async () => {
      const [{ data: states }, { data: cities }] = await Promise.all([
        supabase.from('states').select('slug, name, abbreviation').eq('is_active', true).in('slug', ACTIVE_STATE_SLUGS).order('name'),
        supabase.from('cities').select('slug, name, state_id').eq('is_active', true).order('name').limit(500),
      ]);
      return { states: states || [], cities: cities || [] };
    },
  });

  // Filter pages
  const filteredPages = useMemo(() => {
    if (!allPages) return [];
    
    return allPages.filter(page => {
      // Search filter
      if (searchQuery && !page.slug.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(page.title || '').toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Page type filter
      if (pageType !== 'all' && page.page_type !== pageType) return false;
      
      // State filter
      if (stateFilter && !page.slug.includes(`/${stateFilter}/`)) return false;
      
      // City filter  
      if (cityFilter && !page.slug.includes(`/${cityFilter}`)) return false;
      
      // Status filters
      switch (statusFilter) {
        case 'missing_meta':
          if (page.meta_title && page.meta_description) return false;
          break;
        case 'missing_h1':
          if (page.h1) return false;
          break;
        case 'thin_content':
          if (!page.is_thin_content) return false;
          break;
        case 'no_content':
          if (page.content && (page.word_count || 0) >= 50) return false;
          break;
        case 'duplicate':
          if (!page.is_duplicate) return false;
          break;
        case 'low_score':
          if ((page.seo_score || 100) >= 50) return false;
          break;
        case 'needs_optimization':
          if (!page.needs_optimization) return false;
          break;
        case 'optimized':
          if (!page.is_optimized) return false;
          break;
      }
      
      return true;
    });
  }, [allPages, searchQuery, pageType, statusFilter, stateFilter, cityFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredPages.length / ITEMS_PER_PAGE);
  const paginatedPages = filteredPages.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Selection handlers
  const togglePage = (pageId: string) => {
    if (selectedPages.includes(pageId)) {
      onSelectionChange(selectedPages.filter(id => id !== pageId));
    } else {
      onSelectionChange([...selectedPages, pageId]);
    }
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredPages.map(p => p.id);
    const newSelection = [...new Set([...selectedPages, ...filteredIds])];
    onSelectionChange(newSelection);
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  const selectCurrentPage = () => {
    const currentPageIds = paginatedPages.map(p => p.id);
    const newSelection = [...new Set([...selectedPages, ...currentPageIds])];
    onSelectionChange(newSelection);
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <Badge variant="outline">—</Badge>;
    if (score >= 80) return <Badge className="bg-teal/20 text-teal border-teal/30">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-gold/20 text-gold border-gold/30">{score}</Badge>;
    return <Badge className="bg-coral/20 text-coral border-coral/30">{score}</Badge>;
  };

  const getStatusIcons = (page: SeoPage) => {
    const icons: React.ReactNode[] = [];
    if (!page.meta_title) icons.push(
      <TooltipProvider key="mt"><Tooltip><TooltipTrigger><XCircle className="h-3 w-3 text-destructive" /></TooltipTrigger><TooltipContent>Missing meta title</TooltipContent></Tooltip></TooltipProvider>
    );
    if (!page.meta_description) icons.push(
      <TooltipProvider key="md"><Tooltip><TooltipTrigger><XCircle className="h-3 w-3 text-destructive" /></TooltipTrigger><TooltipContent>Missing meta description</TooltipContent></Tooltip></TooltipProvider>
    );
    if (!page.h1) icons.push(
      <TooltipProvider key="h1"><Tooltip><TooltipTrigger><AlertTriangle className="h-3 w-3 text-gold" /></TooltipTrigger><TooltipContent>Missing H1</TooltipContent></Tooltip></TooltipProvider>
    );
    if (page.is_thin_content) icons.push(
      <TooltipProvider key="tc"><Tooltip><TooltipTrigger><AlertTriangle className="h-3 w-3 text-coral" /></TooltipTrigger><TooltipContent>Thin content</TooltipContent></Tooltip></TooltipProvider>
    );
    if (page.is_duplicate) icons.push(
      <TooltipProvider key="dp"><Tooltip><TooltipTrigger><AlertTriangle className="h-3 w-3 text-coral" /></TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip></TooltipProvider>
    );
    if (icons.length === 0) icons.push(
      <TooltipProvider key="ok"><Tooltip><TooltipTrigger><CheckCircle className="h-3 w-3 text-teal" /></TooltipTrigger><TooltipContent>OK</TooltipContent></Tooltip></TooltipProvider>
    );
    return icons;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Page Picker
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{filteredPages.length} pages</Badge>
            <Badge className="bg-primary/20 text-primary">{selectedPages.length} selected</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by URL or title..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={pageType} onValueChange={(v) => { setPageType(v); setCurrentPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Page Type" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter || '__all__'} onValueChange={(v) => { setStateFilter(v === '__all__' ? '' : v); setCityFilter(''); setCurrentPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All States</SelectItem>
              {filterOptions?.states.map((s: any) => (
                <SelectItem key={s.slug} value={s.slug || '__empty__'}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={selectCurrentPage}>
            Select Page ({paginatedPages.length})
          </Button>
          <Button variant="outline" size="sm" onClick={selectAllFiltered}>
            Select All Filtered ({filteredPages.length})
          </Button>
          <Button variant="ghost" size="sm" onClick={deselectAll}>
            Clear Selection
          </Button>
        </div>

        {/* Table */}
        <ScrollArea className="h-[400px] border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={paginatedPages.length > 0 && paginatedPages.every(p => selectedPages.includes(p.id))}
                    onCheckedChange={(checked) => {
                      if (checked) selectCurrentPage();
                      else {
                        const currentIds = paginatedPages.map(p => p.id);
                        onSelectionChange(selectedPages.filter(id => !currentIds.includes(id)));
                      }
                    }}
                  />
                </TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-16">Score</TableHead>
                <TableHead className="w-16">Words</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading pages...
                  </TableCell>
                </TableRow>
              ) : paginatedPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No pages match your filters
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPages.map(page => (
                  <TableRow key={page.id} className={selectedPages.includes(page.id) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPages.includes(page.id)}
                        onCheckedChange={() => togglePage(page.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[300px] truncate" title={page.slug}>
                      {page.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{page.page_type}</Badge>
                    </TableCell>
                    <TableCell>{getScoreBadge(page.seo_score)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {page.word_count || 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">{getStatusIcons(page)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {onInspectPage && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onInspectPage(page)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        <a href={`https://www.appointpanda.com${page.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredPages.length)} of {filteredPages.length}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
