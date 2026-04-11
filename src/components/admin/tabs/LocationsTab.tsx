import { useState, useMemo } from 'react';
import { useCountries, useAdminCities, useAdminAreas, useCreateCity, useUpdateCity, useCreateArea, useUpdateArea, useAdminStates, useCreateState, useUpdateState, useToggleStateActive, useToggleCityActive, useCitiesWithClinics } from '@/hooks/useAdminLocations';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, MapPin, Globe, Building, Eye, EyeOff, Navigation, Flag, Search, Filter, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import ClinicRedistributionPanel from '@/components/admin/tabs/ClinicRedistributionPanel';
import ContentManagementSection from '@/components/admin/tabs/ContentManagementSection';

export default function LocationsTab() {
  const queryClient = useQueryClient();
  const { data: countries } = useCountries();
  const { data: states, isLoading: statesLoading } = useAdminStates();
  const { data: areas } = useAdminAreas();
  const createCity = useCreateCity();
  const updateCity = useUpdateCity();
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();
  const createState = useCreateState();
  const updateState = useUpdateState();
  const toggleStateActive = useToggleStateActive();
  const toggleCityActive = useToggleCityActive();

  // State filters
  const [stateSearch, setStateSearch] = useState('');
  const [stateStatusFilter, setStateStatusFilter] = useState<string>('all');
  const [stateSeoFilter, setStateSeoFilter] = useState<string>('all');

  // City filters
  const [selectedStateForCities, setSelectedStateForCities] = useState<string>('all');
  const [citySearch, setCitySearch] = useState('');
  const [cityStatusFilter, setCityStatusFilter] = useState<string>('all');
  const [citySeoFilter, setCitySeoFilter] = useState<string>('all');
  const [cityHasClinics, setCityHasClinics] = useState<string>('all');

  // Fetch cities for the selected state or all
  const { data: cities, isLoading: citiesLoading } = useAdminCities(
    selectedStateForCities !== 'all' ? selectedStateForCities : undefined
  );

  // Fetch cities that have clinics
  const { data: citiesWithClinics } = useCitiesWithClinics();
  const cityIdsWithClinics = useMemo(() => 
    new Set(citiesWithClinics?.map(c => c.id) || []), 
    [citiesWithClinics]
  );

  const [cityDialog, setCityDialog] = useState(false);
  const [areaDialog, setAreaDialog] = useState(false);
  const [stateDialog, setStateDialog] = useState(false);
  const [editingCity, setEditingCity] = useState<any>(null);
  const [editingArea, setEditingArea] = useState<any>(null);
  const [editingState, setEditingState] = useState<any>(null);

  const [cityForm, setCityForm] = useState({ name: '', slug: '', state_id: '', is_active: true });
  const [areaForm, setAreaForm] = useState({ name: '', slug: '', city_id: '', is_active: true });
  const [stateForm, setStateForm] = useState({ name: '', abbreviation: '', slug: '', country_code: 'US', is_active: true, seo_status: 'live' });

  // Filtered states
  const filteredStates = useMemo(() => {
    if (!states) return [];
    return states.filter(state => {
      const matchesSearch = stateSearch === '' || 
        state.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
        state.abbreviation?.toLowerCase().includes(stateSearch.toLowerCase());
      const matchesStatus = stateStatusFilter === 'all' || 
        (stateStatusFilter === 'active' && state.is_active) ||
        (stateStatusFilter === 'inactive' && !state.is_active);
      const matchesSeo = stateSeoFilter === 'all' || state.seo_status === stateSeoFilter;
      return matchesSearch && matchesStatus && matchesSeo;
    });
  }, [states, stateSearch, stateStatusFilter, stateSeoFilter]);

  // Filtered cities
  const filteredCities = useMemo(() => {
    if (!cities) return [];
    return cities.filter(city => {
      const matchesSearch = citySearch === '' || 
        city.name.toLowerCase().includes(citySearch.toLowerCase());
      const matchesStatus = cityStatusFilter === 'all' || 
        (cityStatusFilter === 'active' && city.is_active) ||
        (cityStatusFilter === 'inactive' && !city.is_active);
      const matchesSeo = citySeoFilter === 'all' || city.seo_status === citySeoFilter;
      const hasClinics = cityIdsWithClinics.has(city.id);
      const matchesClinics = cityHasClinics === 'all' || 
        (cityHasClinics === 'yes' && hasClinics) ||
        (cityHasClinics === 'no' && !hasClinics);
      return matchesSearch && matchesStatus && matchesSeo && matchesClinics;
    });
  }, [cities, citySearch, cityStatusFilter, citySeoFilter, cityHasClinics, cityIdsWithClinics]);

  const handleSaveCity = async () => {
    if (editingCity) {
      await updateCity.mutateAsync({ id: editingCity.id, updates: cityForm });
    } else {
      await createCity.mutateAsync(cityForm);
    }
    setCityDialog(false);
    setEditingCity(null);
    setCityForm({ name: '', slug: '', state_id: '', is_active: true });
  };

  const handleSaveArea = async () => {
    if (editingArea) {
      await updateArea.mutateAsync({ id: editingArea.id, updates: areaForm });
    } else {
      await createArea.mutateAsync(areaForm);
    }
    setAreaDialog(false);
    setEditingArea(null);
    setAreaForm({ name: '', slug: '', city_id: '', is_active: true });
  };

  const handleSaveState = async () => {
    if (editingState) {
      await updateState.mutateAsync({ id: editingState.id, updates: stateForm });
    } else {
      await createState.mutateAsync(stateForm);
    }
    setStateDialog(false);
    setEditingState(null);
setStateForm({ name: '', abbreviation: '', slug: '', country_code: 'US', is_active: true, seo_status: 'live' });
  };

  const handleToggleStateActive = async (state: any) => {
    await toggleStateActive.mutateAsync({ id: state.id, isActive: !state.is_active });
  };

  const handleToggleCityActive = async (city: any) => {
    await toggleCityActive.mutateAsync({ id: city.id, isActive: !city.is_active });
  };

  const openEditCity = (city: any) => {
    setEditingCity(city);
    setCityForm({
      name: city.name,
      slug: city.slug,
      state_id: city.state_id || '',
      is_active: city.is_active,
    });
    setCityDialog(true);
  };

  const openEditState = (state: any) => {
    setEditingState(state);
    setStateForm({
      name: state.name,
      abbreviation: state.abbreviation || '',
      slug: state.slug,
      country_code: state.country_code || 'US',
      is_active: state.is_active,
      seo_status: state.seo_status || 'live',
    });
    setStateDialog(true);
  };

  const openEditArea = (area: any) => {
    setEditingArea(area);
    setAreaForm({
      name: area.name,
      slug: area.slug,
      city_id: area.city_id,
      is_active: area.is_active,
    });
    setAreaDialog(true);
  };

  // Stats
  const activeStatesCount = states?.filter(s => s.is_active).length || 0;
  const activeCitiesCount = cities?.filter(c => c.is_active).length || 0;
  const citiesWithClinicsCount = cityIdsWithClinics.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Locations Management</h1>
          <p className="text-muted-foreground mt-1">Manage states, cities, and areas - Toggle visibility across the website</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{countries?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Countries</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal/10 flex items-center justify-center">
              <Flag className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{states?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total States</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeStatesCount}</p>
              <p className="text-sm text-muted-foreground">Active States</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <Building className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{cities?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Cities</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral-light flex items-center justify-center">
              <MapPin className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{citiesWithClinicsCount}</p>
              <p className="text-sm text-muted-foreground">Cities with Clinics</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="states" className="space-y-4">
        <TabsList>
          <TabsTrigger value="states">States ({states?.length || 0})</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="redistribution">
            <Navigation className="h-4 w-4 mr-1" />
            Redistribution
          </TabsTrigger>
          <TabsTrigger value="content">
            <FileText className="h-4 w-4 mr-1" />
            Content Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="states">
          <Card className="card-modern">
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-row items-center justify-between">
                <CardTitle>States Management</CardTitle>
                <Dialog open={stateDialog} onOpenChange={setStateDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingState(null); setStateForm({ name: '', abbreviation: '', slug: '', country_code: 'US', is_active: true, seo_status: 'live' }); }}>
                      <Plus className="h-4 w-4 mr-2" />Add State
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingState ? 'Edit State' : 'Add State'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={stateForm.name} onChange={(e) => setStateForm({ ...stateForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="State name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Abbreviation</Label>
                        <Input value={stateForm.abbreviation} onChange={(e) => setStateForm({ ...stateForm, abbreviation: e.target.value.toUpperCase() })} placeholder="e.g. CA" maxLength={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={stateForm.slug} onChange={(e) => setStateForm({ ...stateForm, slug: e.target.value })} placeholder="state-slug" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Active</Label>
                        <Switch checked={stateForm.is_active} onCheckedChange={(checked) => setStateForm({ ...stateForm, is_active: checked })} />
                      </div>
                      <div className="space-y-2">
                        <Label>SEO Status</Label>
                        <Select value={stateForm.seo_status} onValueChange={(value) => setStateForm({ ...stateForm, seo_status: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="SEO Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="live">Live</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleSaveState} className="w-full" disabled={createState.isPending || updateState.isPending}>
                        {editingState ? 'Update' : 'Create'} State
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search states..." 
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={stateStatusFilter} onValueChange={setStateStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stateSeoFilter} onValueChange={setStateSeoFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="SEO Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All SEO</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {statesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Abbreviation</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>SEO Status</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStates.map((state) => (
                      <TableRow key={state.id}>
                        <TableCell className="font-medium">{state.name}</TableCell>
                        <TableCell>{state.abbreviation}</TableCell>
                        <TableCell className="text-muted-foreground">{state.slug}</TableCell>
                        <TableCell>
                          <Badge variant={state.seo_status === 'live' ? 'default' : 'secondary'}>
                            {state.seo_status || 'inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={state.is_active} 
                              onCheckedChange={() => handleToggleStateActive(state)}
                              disabled={toggleStateActive.isPending}
                            />
                            <span className={state.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                              {state.is_active ? 'Visible' : 'Hidden'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {state.is_active && state.seo_status === 'live' ? (
                            <Button variant="ghost" size="sm" onClick={() => window.open(`/${state.slug}`, '_blank')}>
                              <Eye className="h-4 w-4 text-primary" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" disabled>
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openEditState(state)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 text-sm text-muted-foreground">
                Showing {filteredStates.length} of {states?.length || 0} states
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cities">
          <Card className="card-modern">
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-row items-center justify-between">
                <CardTitle>Cities Management</CardTitle>
                <Dialog open={cityDialog} onOpenChange={setCityDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingCity(null); setCityForm({ name: '', slug: '', state_id: states?.[0]?.id || '', is_active: true }); }}>
                      <Plus className="h-4 w-4 mr-2" />Add City
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCity ? 'Edit City' : 'Add City'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>State</Label>
                        <select className="w-full rounded-xl border border-input bg-background px-3 py-2" value={cityForm.state_id} onChange={(e) => setCityForm({ ...cityForm, state_id: e.target.value })}>
                          <option value="">Select State</option>
                          {states?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={cityForm.name} onChange={(e) => setCityForm({ ...cityForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="City name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={cityForm.slug} onChange={(e) => setCityForm({ ...cityForm, slug: e.target.value })} placeholder="city-slug" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Active</Label>
                        <Switch checked={cityForm.is_active} onCheckedChange={(checked) => setCityForm({ ...cityForm, is_active: checked })} />
                      </div>
                      <Button onClick={handleSaveCity} className="w-full" disabled={createCity.isPending || updateCity.isPending}>
                        {editingCity ? 'Update' : 'Create'} City
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <Select value={selectedStateForCities} onValueChange={setSelectedStateForCities}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {states?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search cities..." 
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={cityStatusFilter} onValueChange={setCityStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={citySeoFilter} onValueChange={setCitySeoFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="SEO Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All SEO</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={cityHasClinics} onValueChange={setCityHasClinics}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Has Clinics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    <SelectItem value="yes">Has Clinics</SelectItem>
                    <SelectItem value="no">No Clinics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {citiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Clinics</TableHead>
                      <TableHead>SEO Status</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCities.slice(0, 100).map((city) => {
                      const hasClinics = cityIdsWithClinics.has(city.id);
                      return (
                        <TableRow key={city.id}>
                          <TableCell className="font-medium">{city.name}</TableCell>
                          <TableCell className="text-muted-foreground">{city.state?.abbreviation || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{city.slug}</TableCell>
                          <TableCell>
                            {hasClinics ? (
                              <Badge className="bg-green-100 text-green-700">Has Clinics</Badge>
                            ) : (
                              <Badge variant="secondary">None</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={city.seo_status === 'live' ? 'default' : 'secondary'}>
                              {city.seo_status || 'inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={city.is_active} 
                                onCheckedChange={() => handleToggleCityActive(city)}
                                disabled={toggleCityActive.isPending}
                              />
                              <span className={city.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                                {city.is_active ? 'Visible' : 'Hidden'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            {city.is_active ? (
                              <Button variant="ghost" size="sm" onClick={() => window.open(`/dentists-in-${city.slug}`, '_blank')}>
                                <Eye className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" disabled>
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openEditCity(city)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 text-sm text-muted-foreground">
                Showing {Math.min(filteredCities.length, 100)} of {filteredCities.length} filtered cities 
                {selectedStateForCities !== 'all' && ` (${cities?.length || 0} in selected state)`}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="areas">
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Areas</CardTitle>
              <Dialog open={areaDialog} onOpenChange={setAreaDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingArea(null); setAreaForm({ name: '', slug: '', city_id: cities?.[0]?.id || '', is_active: true }); }}>
                    <Plus className="h-4 w-4 mr-2" />Add Area
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingArea ? 'Edit Area' : 'Add Area'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <select className="w-full rounded-xl border border-input bg-background px-3 py-2" value={areaForm.city_id} onChange={(e) => setAreaForm({ ...areaForm, city_id: e.target.value })}>
                        {cities?.slice(0, 100).map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="Area name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input value={areaForm.slug} onChange={(e) => setAreaForm({ ...areaForm, slug: e.target.value })} placeholder="area-slug" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Active</Label>
                      <Switch checked={areaForm.is_active} onCheckedChange={(checked) => setAreaForm({ ...areaForm, is_active: checked })} />
                    </div>
                    <Button onClick={handleSaveArea} className="w-full" disabled={createArea.isPending || updateArea.isPending}>
                      {editingArea ? 'Update' : 'Create'} Area
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areas?.slice(0, 100).map((area) => (
                    <TableRow key={area.id}>
                      <TableCell className="font-medium">{area.name}</TableCell>
                      <TableCell className="text-muted-foreground">{area.city?.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{area.slug}</TableCell>
                      <TableCell>
                        <Badge variant={area.is_active ? 'default' : 'secondary'}>{area.is_active ? 'Active' : 'Inactive'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditArea(area)}><Edit className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redistribution">
          <ClinicRedistributionPanel />
        </TabsContent>

        <TabsContent value="content">
          <ContentManagementSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}