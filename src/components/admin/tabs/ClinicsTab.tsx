import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminClinics, useUpdateClinic, useAdminDentists, useCreateClinic, useCreateDentist } from '@/hooks/useAdminClinics';
import { usePauseClinic, useDeleteClinic, useVerifyClinic, useClaimClinic } from '@/hooks/useAdminClinicsExtended';
import { useAdminCities, useAdminAreas, useCountries } from '@/hooks/useAdminLocations';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useRealCounts } from '@/hooks/useRealCounts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Users, Search, Edit, Star, MapPin, Phone, Mail, Shield, CheckCircle, Plus, MoreVertical, Pause, Play, Trash2, Crown, ShieldCheck, ShieldX, UserX, UserPlus as AssignUser, ChevronLeft, ChevronRight, Globe, Download, RefreshCw, Loader2, FileText, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

const WORD_COUNT_OPTIONS = [100, 200, 300, 400, 500];

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000];

export default function ClinicsTab() {
  const [filters, setFilters] = useState({ search: '', verificationStatus: '', claimStatus: '', source: '', cityId: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
  const { data: clinics, isLoading, refetch } = useAdminClinics({ 
    search: filters.search, 
    verificationStatus: filters.verificationStatus || undefined,
    claimStatus: filters.claimStatus || undefined,
    source: filters.source || undefined,
    cityId: filters.cityId || undefined
  });
  const { data: dentists, refetch: refetchDentists } = useAdminDentists();
  const { data: cities } = useAdminCities();
  const { data: realCounts } = useRealCounts();
  const [selectedCityId, setSelectedCityId] = useState('');
  const { data: areas } = useAdminAreas(selectedCityId || undefined);
  
  // Real total count from database (not limited)
  const { data: totalClinicCount = 0 } = useQuery({
    queryKey: ['total-clinic-count'],
    queryFn: async () => {
      const { count } = await supabase.from('clinics').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });
  
  const { data: totalDentistCount = 0 } = useQuery({
    queryKey: ['total-dentist-count'],
    queryFn: async () => {
      const { count } = await supabase.from('dentists').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });
  const updateClinic = useUpdateClinic();
  const pauseClinic = usePauseClinic();
  const deleteClinic = useDeleteClinic();
  const verifyClinic = useVerifyClinic();
  const claimClinic = useClaimClinic();
  const createClinic = useCreateClinic();
  const createDentist = useCreateDentist();

  const { data: allUsers } = useAdminUsers();

  const [editDialog, setEditDialog] = useState(false);
  const [addClinicDialog, setAddClinicDialog] = useState(false);
  const [addDentistDialog, setAddDentistDialog] = useState(false);
  const [assignUserDialog, setAssignUserDialog] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [clinicForm, setClinicForm] = useState({ name: '', slug: '', phone: '', email: '', address: '', city_id: '', area_id: '', website: '' });
  const [dentistForm, setDentistForm] = useState({ name: '', slug: '', title: '', clinic_id: '', experience_years: 0, bio: '' });
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Bulk description generation state
  const [selectedClinicIds, setSelectedClinicIds] = useState<Set<string>>(new Set());
  const [selectedWordCount, setSelectedWordCount] = useState(200);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  const toggleSelectClinic = (clinicId: string) => {
    setSelectedClinicIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clinicId)) {
        newSet.delete(clinicId);
      } else {
        newSet.add(clinicId);
      }
      return newSet;
    });
  };

  const selectAllClinics = () => {
    if (selectedClinicIds.size === paginatedClinics.length) {
      setSelectedClinicIds(new Set());
    } else {
      setSelectedClinicIds(new Set(paginatedClinics.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedClinicIds(new Set());
  };

  const handleBulkGenerate = async () => {
    if (selectedClinicIds.size === 0) return;

    setIsBulkGenerating(true);
    setShowBulkDialog(false);

    const CHUNK_SIZE = 25;
    const allIds = Array.from(selectedClinicIds);
    const chunks: string[][] = [];
    for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
      chunks.push(allIds.slice(i, i + CHUNK_SIZE));
    }

    let processedTotal = 0;
    let errorsTotal = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        const { data, error } = await supabase.functions.invoke('batch-enrich-clinics', {
          body: {
            action: 'generate_bulk_descriptions',
            clinicIds: chunks[i],
            wordCount: selectedWordCount,
          },
        });

        if (error) throw error;

        processedTotal += data?.processed || 0;
        errorsTotal += data?.errors || 0;

        // small pause to avoid rate-limit spikes
        await new Promise((r) => setTimeout(r, 150));
      }

      toast.success(`Generated descriptions for ${processedTotal} clinics`, {
        description: errorsTotal > 0 ? `${errorsTotal} clinics had errors` : undefined,
      });

      setSelectedClinicIds(new Set());
      refetch();
    } catch (error) {
      console.error('Bulk generation error:', error);
      toast.error('Failed to generate descriptions');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  // Filter users for assignment dialog
  const filteredUsers = allUsers?.filter(u => {
    if (!userSearchQuery) return true;
    const query = userSearchQuery.toLowerCase();
    return (
      u.email?.toLowerCase().includes(query) ||
      u.full_name?.toLowerCase().includes(query)
    );
  }) || [];

  const openAssignDialog = (clinic: any) => {
    setSelectedClinic(clinic);
    setUserSearchQuery('');
    setAssignUserDialog(true);
  };

  const handleAssignUser = async (userId: string) => {
    if (!selectedClinic) return;
    setIsAssigning(true);
    try {
      await claimClinic.mutateAsync({ id: selectedClinic.id, userId });
      setAssignUserDialog(false);
      setSelectedClinic(null);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsAssigning(false);
    }
  };

  // Pagination
  const totalClinics = clinics?.length || 0;
  const totalPages = Math.ceil(totalClinics / itemsPerPage);
  const paginatedClinics = clinics?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [];
  
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const openEdit = (clinic: any) => {
    setSelectedClinic(clinic);
    setEditForm({
      name: clinic.name,
      email: clinic.email || '',
      phone: clinic.phone || '',
      address: clinic.address || '',
      is_featured: clinic.is_featured,
      is_suspended: clinic.is_suspended,
      seo_visible: clinic.seo_visible,
      verification_status: clinic.verification_status,
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    await updateClinic.mutateAsync({ id: selectedClinic.id, updates: editForm });
    setEditDialog(false);
    setSelectedClinic(null);
  };

  const handleCreateClinic = async () => {
    const slug = clinicForm.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
    await createClinic.mutateAsync({ ...clinicForm, slug });
    setAddClinicDialog(false);
    setClinicForm({ name: '', slug: '', phone: '', email: '', address: '', city_id: '', area_id: '', website: '' });
  };

  const handleCreateDentist = async () => {
    const slug = dentistForm.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
    await createDentist.mutateAsync({ ...dentistForm, slug, experience_years: dentistForm.experience_years || null });
    setAddDentistDialog(false);
    setDentistForm({ name: '', slug: '', title: '', clinic_id: '', experience_years: 0, bio: '' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-primary text-primary-foreground"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'pending': return <Badge variant="outline" className="text-gold border-gold">Pending</Badge>;
      case 'expired': return <Badge variant="destructive">Expired</Badge>;
      default: return <Badge variant="secondary">Unverified</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Dental Offices</h1>
          <p className="text-muted-foreground mt-1">Manage clinics and dentists</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addClinicDialog} onOpenChange={setAddClinicDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => setClinicForm({ name: '', slug: '', phone: '', email: '', address: '', city_id: cities?.[0]?.id || '', area_id: '', website: '' })}>
                <Plus className="h-4 w-4 mr-2" />
                Add Clinic
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Clinic</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={clinicForm.name} onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })} placeholder="Clinic name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Select value={clinicForm.city_id} onValueChange={(v) => { setClinicForm({ ...clinicForm, city_id: v, area_id: '' }); setSelectedCityId(v); }}>
                      <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                      <SelectContent>
                        {cities?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Area</Label>
                    <Select value={clinicForm.area_id} onValueChange={(v) => setClinicForm({ ...clinicForm, area_id: v })} disabled={!clinicForm.city_id}>
                      <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                      <SelectContent>
                        {areas?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={clinicForm.phone} onChange={(e) => setClinicForm({ ...clinicForm, phone: e.target.value })} placeholder="+971 4 XXX XXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={clinicForm.email} onChange={(e) => setClinicForm({ ...clinicForm, email: e.target.value })} placeholder="clinic@email.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={clinicForm.address} onChange={(e) => setClinicForm({ ...clinicForm, address: e.target.value })} placeholder="Full address" />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={clinicForm.website} onChange={(e) => setClinicForm({ ...clinicForm, website: e.target.value })} placeholder="https://..." />
                </div>
                <Button onClick={handleCreateClinic} className="w-full" disabled={!clinicForm.name || createClinic.isPending}>
                  Create Clinic
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={addDentistDialog} onOpenChange={setAddDentistDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => setDentistForm({ name: '', slug: '', title: '', clinic_id: clinics?.[0]?.id || '', experience_years: 0, bio: '' })}>
                <Plus className="h-4 w-4 mr-2" />
                Add Dentist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Dentist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={dentistForm.name} onChange={(e) => setDentistForm({ ...dentistForm, name: e.target.value })} placeholder="Dr. Name" />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={dentistForm.title} onChange={(e) => setDentistForm({ ...dentistForm, title: e.target.value })} placeholder="General Dentist, Orthodontist, etc." />
                </div>
                <div className="space-y-2">
                  <Label>Clinic</Label>
                  <Select value={dentistForm.clinic_id} onValueChange={(v) => setDentistForm({ ...dentistForm, clinic_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select clinic" /></SelectTrigger>
                    <SelectContent>
                      {clinics?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Experience (years)</Label>
                  <Input type="number" value={dentistForm.experience_years} onChange={(e) => setDentistForm({ ...dentistForm, experience_years: parseInt(e.target.value) || 0 })} />
                </div>
                <Button onClick={handleCreateDentist} className="w-full" disabled={!dentistForm.name || createDentist.isPending}>
                  Create Dentist
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalClinicCount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Clinics</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalDentistCount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Dentists</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <Shield className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clinics?.filter(c => c.verification_status === 'verified').length || 0}</p>
              <p className="text-sm text-muted-foreground">Verified</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Star className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clinics?.filter(c => c.claim_status === 'claimed').length || 0}</p>
              <p className="text-sm text-muted-foreground">Claimed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-light flex items-center justify-center">
              <Globe className="h-6 w-6 text-purple" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clinics?.filter(c => c.source === 'gmb').length || 0}</p>
              <p className="text-sm text-muted-foreground">GMB Imported</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clinics..."
                value={filters.search}
                onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
            <Select value={filters.cityId || ''} onValueChange={(v) => handleFilterChange({ ...filters, cityId: v === 'all' ? '' : v })}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities?.map(city => (
                  <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.verificationStatus} onValueChange={(v) => handleFilterChange({ ...filters, verificationStatus: v === 'all' ? '' : v })}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.claimStatus || ''} onValueChange={(v) => handleFilterChange({ ...filters, claimStatus: v === 'all' ? '' : v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Claim Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Claims</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="unclaimed">Unclaimed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.source || ''} onValueChange={(v) => handleFilterChange({ ...filters, source: v === 'all' ? '' : v })}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="gmb">GMB Import</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => { refetch(); refetchDentists(); }} title="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Showing {clinics?.length.toLocaleString() || 0} of {totalClinicCount.toLocaleString()} total clinics
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="clinics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clinics">Clinics</TabsTrigger>
          <TabsTrigger value="dentists">Dentists</TabsTrigger>
        </TabsList>

        <TabsContent value="clinics">
          <Card className="card-modern">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedClinicIds.size === paginatedClinics.length && paginatedClinics.length > 0}
                        onCheckedChange={selectAllClinics}
                      />
                    </TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Claim</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClinics.map((clinic) => (
                    <TableRow key={clinic.id} className={selectedClinicIds.has(clinic.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedClinicIds.has(clinic.id)}
                          onCheckedChange={() => toggleSelectClinic(clinic.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{clinic.name}</p>
                            <p className="text-xs text-muted-foreground">{clinic.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {clinic.city?.name || '-'}, {clinic.area?.name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {clinic.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {clinic.phone}
                            </div>
                          )}
                          {clinic.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {clinic.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-gold text-gold" />
                          <span className="font-medium">{clinic.rating?.toFixed(1) || '-'}</span>
                          <span className="text-muted-foreground text-sm">({clinic.review_count || 0})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(clinic.verification_status || 'unverified')}
                          {clinic.verification_status !== 'verified' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
                              onClick={() => updateClinic.mutateAsync({ id: clinic.id, updates: { verification_status: 'verified' } })}
                            >
                              Verify
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={clinic.claim_status === 'claimed' ? 'default' : 'outline'}>
                          {clinic.claim_status || 'unclaimed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => window.open(`/clinic/${clinic.slug}`, '_blank', 'noopener,noreferrer')}
                            >
                              <Globe className="h-4 w-4 mr-2" />
                              View Public Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(clinic)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {clinic.verification_status === 'verified' ? (
                              <DropdownMenuItem 
                                onClick={() => verifyClinic.mutate({ id: clinic.id, verified: false })}
                                className="text-coral"
                              >
                                <ShieldX className="h-4 w-4 mr-2" />
                                Revoke Verification
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => verifyClinic.mutate({ id: clinic.id, verified: true })}
                                className="text-teal"
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Verify Clinic
                              </DropdownMenuItem>
                            )}
                            {clinic.is_active ? (
                              <DropdownMenuItem 
                                onClick={() => pauseClinic.mutate({ id: clinic.id, isPaused: true })}
                                className="text-gold"
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pause Clinic
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => pauseClinic.mutate({ id: clinic.id, isPaused: false })}
                                className="text-teal"
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Reactivate Clinic
                              </DropdownMenuItem>
                            )}
                            {clinic.claim_status === 'claimed' ? (
                              <DropdownMenuItem 
                                onClick={() => claimClinic.mutate({ id: clinic.id, userId: null })}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Revoke Claim
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => openAssignDialog(clinic)}>
                                <AssignUser className="h-4 w-4 mr-2" />
                                Assign Owner
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Clinic
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Clinic</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{clinic.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteClinic.mutate(clinic.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedClinics.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No clinics found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalClinics)} of {totalClinics.toLocaleString()} clinics
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Per page:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map(size => (
                          <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Floating Bulk Action Bar */}
          {selectedClinicIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border border-border shadow-xl rounded-xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{selectedClinicIds.size} clinics selected</p>
                  <p className="text-xs text-muted-foreground">Ready to generate descriptions</p>
                </div>
              </div>
              
              <div className="h-8 w-px bg-border" />
              
              <Button variant="outline" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
              
              <Select value={selectedWordCount.toString()} onValueChange={(v) => setSelectedWordCount(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORD_COUNT_OPTIONS.map(count => (
                    <SelectItem key={count} value={count.toString()}>{count} words</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={() => setShowBulkDialog(true)} 
                disabled={isBulkGenerating}
                className="gap-2"
              >
                {isBulkGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Descriptions
                  </>
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dentists">
          <Card className="card-modern">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dentist</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dentists?.map((dentist) => (
                    <TableRow key={dentist.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-light flex items-center justify-center">
                            <Users className="h-5 w-5 text-blue-custom" />
                          </div>
                          <div>
                            <p className="font-medium">{dentist.name}</p>
                            <p className="text-xs text-muted-foreground">{dentist.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{dentist.title || '-'}</TableCell>
                      <TableCell>{dentist.years_experience ? `${dentist.years_experience} years` : '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-gold text-gold" />
                          <span>{dentist.rating?.toFixed(1) || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={dentist.is_active ? 'default' : 'secondary'}>
                          {dentist.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!dentists || dentists.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No dentists found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Clinic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={editForm.address || ''} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Verification Status</Label>
              <Select value={editForm.verification_status} onValueChange={(v) => setEditForm({ ...editForm, verification_status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unverified">Unverified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Featured</Label>
              <Switch checked={editForm.is_featured} onCheckedChange={(v) => setEditForm({ ...editForm, is_featured: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>SEO Visible</Label>
              <Switch checked={editForm.seo_visible} onCheckedChange={(v) => setEditForm({ ...editForm, seo_visible: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Suspended</Label>
              <Switch checked={editForm.is_suspended} onCheckedChange={(v) => setEditForm({ ...editForm, is_suspended: v })} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={updateClinic.isPending}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Generation Confirmation Dialog */}
      <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Descriptions</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate AI-powered descriptions ({selectedWordCount} words each) for {selectedClinicIds.size} selected clinics. 
              Existing descriptions will be overwritten. This action may take a few minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkGenerate}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign User Dialog */}
      <Dialog open={assignUserDialog} onOpenChange={setAssignUserDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Clinic Owner</DialogTitle>
            <DialogDescription>
              Select a user to assign ownership of "{selectedClinic?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <ScrollArea className="h-[300px] border rounded-lg">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {userSearchQuery ? 'No users found' : 'Start typing to search users'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredUsers.slice(0, 50).map((user) => (
                    <div
                      key={user.id}
                      className="p-3 hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-between"
                      onClick={() => handleAssignUser(user.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{user.full_name || 'No Name'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {user.roles?.[0] || 'patient'}
                        </Badge>
                        {isAssigning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            Assign
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            <p className="text-xs text-muted-foreground text-center">
              This will assign the dentist role and link the clinic to the selected user.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
