import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Building2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Mail, 
  Phone, 
  Globe,
  Search,
  Eye,
  Edit,
  Trash2,
  Shield,
  User,
  Calendar,
  Stethoscope,
  Loader2,
  AlertTriangle,
  CheckSquare,
  XSquare,
  MoreHorizontal,
  TrendingUp,
  Users,
  FileText,
  ExternalLink,
  RefreshCw,
  Filter,
  Download,
  Sparkles,
  Star
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  'draft': { label: 'Draft', color: 'bg-slate-100 text-slate-700', icon: Clock },
  'submitted': { label: 'Submitted', color: 'bg-amber-100 text-amber-700', icon: Clock },
  'under_review': { label: 'Under Review', color: 'bg-blue-100 text-blue-700', icon: Clock },
  'approved': { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  'rejected': { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  'suspended': { label: 'Suspended', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  'active': { label: 'Active', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
};

const VERIFICATION_CONFIG = {
  'verified': { label: 'Verified', color: 'bg-green-500' },
  'pending': { label: 'Pending', color: 'bg-amber-500' },
  'unverified': { label: 'Unverified', color: 'bg-slate-500' },
};

export default function ListingsQueueTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('all');
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch states for filter
  const { data: states } = useQuery({
    queryKey: ['states-list'],
    queryFn: async () => {
      const { data } = await supabase.from('states').select('id, name, abbreviation').eq('is_active', true).order('name');
      return data || [];
    },
  });

  // Fetch all listings with status
  const { data: listings, isLoading, refetch } = useQuery({
    queryKey: ['admin-listings', activeTab, selectedState],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select(`
          *,
          city:cities(id, name, slug, state_id, state:states(id, name, abbreviation)),
          members:clinic_members(user_id, role, status),
          services:treatment_id(count)
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') {
        query = query.in('listing_status', ['submitted', 'under_review']);
      } else if (activeTab === 'approved') {
        query = query.eq('listing_status', 'approved');
      } else if (activeTab === 'rejected') {
        query = query.eq('listing_status', 'rejected');
      } else if (activeTab === 'active') {
        query = query.eq('listing_status', 'active');
      }

      let { data, error } = await query;
      if (error) throw error;
      
      // Filter by state if selected
      if (selectedState !== 'all' && data) {
        const state = states?.find((s: any) => s.slug === selectedState);
        if (state) {
          data = data.filter((l: any) => l.city?.state_id === state.id);
        }
      }
      
      return data || [];
    },
    enabled: !!states,
  });

  // Filter by search
  const filteredListings = listings?.filter(l => 
    l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.city?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Get counts
  const { data: counts } = useQuery({
    queryKey: ['admin-listing-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('listing_status');
      const all = data || [];
      return {
        pending: all.filter(l => ['submitted', 'under_review'].includes(l.listing_status)).length,
        approved: all.filter(l => l.listing_status === 'approved').length,
        rejected: all.filter(l => l.listing_status === 'rejected').length,
        active: all.filter(l => l.listing_status === 'active' || !l.listing_status).length,
        total: all.length,
      };
    },
  });

  // Approve listing
  const approveListing = useMutation({
    mutationFn: async ({ listingId, notes }: { listingId: string; notes?: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          listing_status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', listingId);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-listing-counts'] });
      setApproveDialog(false);
      setSelectedListing(null);
      setAdminNotes('');
    },
  });

  // Reject listing
  const rejectListing = useMutation({
    mutationFn: async ({ listingId, reason }: { listingId: string; reason: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          listing_status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', listingId);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-listing-counts'] });
      setRejectDialog(false);
      setSelectedListing(null);
      setRejectReason('');
    },
  });

  // Bulk approve
  const bulkApprove = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          listing_status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .in('id', ids);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-listing-counts'] });
      setSelectedListings(new Set());
    },
  });

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedListings);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedListings(newSet);
  };

  // Toggle all
  const toggleAll = () => {
    if (selectedListings.size === filteredListings.length) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(new Set(filteredListings.map((l: any) => l.id)));
    }
  };

  const openView = (listing: any) => {
    setSelectedListing(listing);
    setViewDialog(true);
  };

  const openApprove = (listing: any) => {
    setSelectedListing(listing);
    setApproveDialog(true);
  };

  const openReject = (listing: any) => {
    setSelectedListing(listing);
    setRejectDialog(true);
  };

  const handleBulkApprove = () => {
    bulkApprove.mutate({ 
      ids: Array.from(selectedListings), 
      notes: adminNotes 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{counts?.pending || 0}</p>
                <p className="text-xs text-amber-600">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{counts?.approved || 0}</p>
                <p className="text-xs text-blue-600">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{counts?.active || 0}</p>
                <p className="text-xs text-emerald-600">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">{counts?.rejected || 0}</p>
                <p className="text-xs text-red-600">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-500 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-700">{counts?.total || 0}</p>
                <p className="text-xs text-slate-600">Total Listings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Listings Queue
              </CardTitle>
              <CardDescription>Manage clinic listings, submissions, and approvals</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Bulk Actions */}
              {selectedListings.size > 0 && activeTab === 'pending' && (
                <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-primary/10 rounded-lg">
                  <span className="text-sm font-medium">{selectedListings.size} selected</span>
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={handleBulkApprove}
                    disabled={bulkApprove.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-72"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-primary/10' : ''}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Filters Panel */}
          {showFilters && (
            <div className="flex items-center gap-4 mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="text-sm">State:</Label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {states?.map((state: any) => (
                      <SelectItem key={state.id} value={state.slug}>
                        {state.name} ({state.abbreviation})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSelectedState('all');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending
                {counts?.pending ? (
                  <Badge variant="secondary" className="ml-1">{counts.pending}</Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Approved
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                <Building2 className="h-4 w-4" />
                Active
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2">
                <XCircle className="h-4 w-4" />
                Rejected
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No listings found</p>
                  <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {activeTab === 'pending' && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedListings.size === filteredListings.length && filteredListings.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                      )}
                      <TableHead>Clinic</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredListings.map((listing: any) => (
                      <TableRow key={listing.id} className={selectedListings.has(listing.id) ? 'bg-primary/5' : ''}>
                        {activeTab === 'pending' && (
                          <TableCell>
                            <Checkbox
                              checked={selectedListings.has(listing.id)}
                              onCheckedChange={() => toggleSelection(listing.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{listing.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {listing.email}
                                {listing.phone && (
                                  <>
                                    <span>•</span>
                                    <Phone className="h-3 w-3" />
                                    {listing.phone}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{listing.city?.name}, {listing.city?.state?.abbreviation}</span>
                          </div>
                          {listing.address && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {listing.address}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_CONFIG[listing.listing_status as keyof typeof STATUS_CONFIG]?.color || 'bg-slate-100'}>
                            {STATUS_CONFIG[listing.listing_status as keyof typeof STATUS_CONFIG]?.label || listing.listing_status || 'Draft'}
                          </Badge>
                          {listing.claim_status === 'claimed' && (
                            <Badge variant="outline" className="ml-1 border-green-500 text-green-600">
                              <User className="h-3 w-3 mr-1" />
                              Claimed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={VERIFICATION_CONFIG[listing.verification_status as keyof typeof VERIFICATION_CONFIG]?.color || 'bg-slate-500'}>
                            {listing.verification_status || 'unverified'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full" 
                                style={{ width: `${listing.completion_score || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {listing.completion_score || 0}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {listing.created_at ? format(new Date(listing.created_at), 'MMM d, yyyy') : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openView(listing)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {listing.listing_status === 'submitted' && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-green-600"
                                  onClick={() => openApprove(listing)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-600"
                                  onClick={() => openReject(listing)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {listing.listing_status === 'under_review' && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-green-600"
                                onClick={() => openApprove(listing)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg">{selectedListing?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={STATUS_CONFIG[selectedListing?.listing_status as keyof typeof STATUS_CONFIG]?.color || 'bg-slate-100'}>
                    {STATUS_CONFIG[selectedListing?.listing_status as keyof typeof STATUS_CONFIG]?.label || 'Draft'}
                  </Badge>
                  <Badge variant="outline" className={VERIFICATION_CONFIG[selectedListing?.verification_status as keyof typeof VERIFICATION_CONFIG]?.color || 'bg-slate-500'}>
                    {selectedListing?.verification_status || 'unverified'}
                  </Badge>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedListing && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Contact Information
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {selectedListing.email || '-'}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedListing.phone || '-'}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {selectedListing.website || '-'}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Location
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {selectedListing.city?.name}, {selectedListing.city?.state?.abbreviation}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {selectedListing.address || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedListing.description && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    About
                  </h4>
                  <p className="text-sm text-muted-foreground">{selectedListing.description}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-xl font-bold">{selectedListing.completion_score || 0}%</p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-xl font-bold">{selectedListing.members?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Team</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-xl font-bold">{selectedListing.rating || '-'}</p>
                  <p className="text-xs text-muted-foreground">Rating</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-xl font-bold">{selectedListing.review_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Reviews</p>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  Created: {selectedListing.created_at ? format(new Date(selectedListing.created_at), 'PPpp') : '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated: {selectedListing.updated_at ? format(new Date(selectedListing.updated_at), 'PPpp') : '-'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-4 border-t">
                {selectedListing.listing_status === 'submitted' && (
                  <>
                    <Button 
                      variant="default" 
                      className="flex-1"
                      onClick={() => {
                        setViewDialog(false);
                        openApprove(selectedListing);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 text-red-600"
                      onClick={() => {
                        setViewDialog(false);
                        openReject(selectedListing);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedListing.listing_status === 'under_review' && (
                  <Button 
                    variant="default" 
                    className="flex-1"
                    onClick={() => {
                      setViewDialog(false);
                      openApprove(selectedListing);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Approve Listing
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p>Are you sure you want to approve <strong>{selectedListing?.name}</strong>?</p>
            
            <div>
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this approval..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="default"
              onClick={() => approveListing.mutate({ listingId: selectedListing?.id, notes: adminNotes })}
              disabled={approveListing.isPending}
            >
              {approveListing.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Reject Listing
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p>Are you sure you want to reject <strong>{selectedListing?.name}</strong>?</p>
            
            <div>
              <Label>Reason for rejection *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this listing is being rejected..."
                rows={3}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => rejectListing.mutate({ listingId: selectedListing?.id, reason: rejectReason })}
              disabled={rejectListing.isPending || !rejectReason}
            >
              {rejectListing.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}