import { useState } from 'react';
import { useAdminLeads, useUpdateLead } from '@/hooks/useAdminLeads';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  Building2, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle,
  BadgeCheck,
  Loader2,
  ExternalLink,
  MapPin,
  Globe,
  Stethoscope
} from 'lucide-react';
import { format } from 'date-fns';

export default function LeadsTab() {
  const [filters, setFilters] = useState({ status: '', search: '' });
  const { data: leads, isLoading, refetch } = useAdminLeads({ status: filters.status || undefined });
  const updateLead = useUpdateLead();

  const [noteDialog, setNoteDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const handleStatusChange = async (id: string, status: string) => {
    await updateLead.mutateAsync({ id, updates: { status: status as any } });
  };

  const handleSaveNotes = async () => {
    if (selectedLead) {
      await updateLead.mutateAsync({ id: selectedLead.id, updates: { message: notes } });
      setNoteDialog(false);
      setSelectedLead(null);
    }
  };

  const openNotes = (lead: any) => {
    setSelectedLead(lead);
    setNotes(lead.message || '');
    setNoteDialog(true);
  };

  const openApproveDialog = (lead: any) => {
    setSelectedLead(lead);
    setApproveDialog(true);
  };

  const handleApproveListing = async () => {
    if (!selectedLead) return;

    setIsApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke('approve-listing', {
        body: { leadId: selectedLead.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Listing approved! User account created and notifications sent.');
        setApproveDialog(false);
        setSelectedLead(null);
        refetch();
      } else {
        throw new Error(data?.error || 'Failed to approve listing');
      }
    } catch (error: any) {
      console.error('Approve listing error:', error);
      toast.error(error.message || 'Failed to approve listing');
    } finally {
      setIsApproving(false);
    }
  };

  // Parse listing data from lead message
  const parseListingData = (message: string | null) => {
    if (!message) return null;
    try {
      const data = JSON.parse(message);
      if (data.type === 'practice_listing') {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'contacted': return <Badge className="bg-blue-custom text-blue-custom-foreground"><Phone className="h-3 w-3 mr-1" />Contacted</Badge>;
      case 'qualified': return <Badge className="bg-gold text-gold-foreground"><CheckCircle className="h-3 w-3 mr-1" />Qualified</Badge>;
      case 'converted': return <Badge className="bg-primary text-primary-foreground"><CheckCircle className="h-3 w-3 mr-1" />Converted</Badge>;
      case 'lost': return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Lost</Badge>;
      case 'spam': return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Spam</Badge>;
      default: return <Badge variant="outline" className="text-gold border-gold"><Clock className="h-3 w-3 mr-1" />New</Badge>;
    }
  };

  const statusCounts = {
    new: leads?.filter(l => l.status === 'new').length || 0,
    contacted: leads?.filter(l => l.status === 'contacted').length || 0,
    qualified: leads?.filter(l => l.status === 'qualified').length || 0,
    converted: leads?.filter(l => l.status === 'converted').length || 0,
    lost: leads?.filter(l => l.status === 'lost').length || 0,
  };

  const filteredLeads = leads?.filter(l =>
    l.patient_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
    l.patient_phone?.includes(filters.search) ||
    l.patient_email?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  // Separate listing requests from regular leads
  const listingRequests = filteredLeads.filter(l => l.source === 'list-your-practice');
  const regularLeads = filteredLeads.filter(l => l.source !== 'list-your-practice');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Lead CRM</h1>
        <p className="text-muted-foreground mt-1">Manage leads, listing requests, and track conversions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Clock className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statusCounts.new}</p>
              <p className="text-sm text-muted-foreground">New</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <Phone className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statusCounts.contacted}</p>
              <p className="text-sm text-muted-foreground">Contacted</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-light flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-purple" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statusCounts.qualified}</p>
              <p className="text-sm text-muted-foreground">Qualified</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statusCounts.converted}</p>
              <p className="text-sm text-muted-foreground">Converted</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral-light flex items-center justify-center">
              <XCircle className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statusCounts.lost}</p>
              <p className="text-sm text-muted-foreground">Lost</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v === 'all' ? '' : v })}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Practice Listing Requests */}
      {listingRequests.length > 0 && (
        <Card className="card-modern border-primary/30">
          <CardContent className="p-0">
            <div className="p-4 border-b bg-primary/5">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">Practice Listing Requests</h2>
                <Badge variant="secondary">{listingRequests.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Review and approve new practice listings</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practice</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listingRequests.map((lead) => {
                  const listingData = parseListingData(lead.message);
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div>
                          <div className="font-bold">{listingData?.clinicName || lead.patient_name}</div>
                          <div className="text-sm text-muted-foreground">{listingData?.dentistName || 'Unknown'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {lead.patient_phone}
                          </div>
                          {lead.patient_email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {lead.patient_email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {listingData?.city && listingData?.state ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {listingData.city}, {listingData.state}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.status || 'new')}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.created_at ? format(new Date(lead.created_at), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {lead.status !== 'converted' && (
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90"
                              onClick={() => openApproveDialog(lead)}
                            >
                              <BadgeCheck className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openNotes(lead)}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Select value={lead.status || 'new'} onValueChange={(v) => handleStatusChange(lead.id, v)}>
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="qualified">Qualified</SelectItem>
                              <SelectItem value="converted">Converted</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                              <SelectItem value="spam">Spam</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Regular Leads Table */}
      <Card className="card-modern">
        <CardContent className="p-0">
          {regularLeads.length > 0 && (
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg">General Leads</h2>
              <p className="text-sm text-muted-foreground">Patient inquiries and booking requests</p>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regularLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-medium">{lead.patient_name}</div>
                    {lead.message && (
                      <p className="text-xs text-muted-foreground truncate max-w-48">{lead.message}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {lead.patient_phone}
                      </div>
                      {lead.patient_email && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {lead.patient_email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {lead.clinic?.name || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.source || 'website'}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(lead.status || 'new')}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.created_at ? format(new Date(lead.created_at), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openNotes(lead)}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Select value={lead.status || 'new'} onValueChange={(v) => handleStatusChange(lead.id, v)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                          <SelectItem value="spam">Spam</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {regularLeads.length === 0 && listingRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No leads found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead Notes - {selectedLead?.patient_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Internal Notes / Message</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this lead..."
                rows={6}
              />
            </div>
            <Button onClick={handleSaveNotes} className="w-full" disabled={updateLead.isPending}>
              Save Notes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Listing Dialog */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-primary" />
              Approve Practice Listing
            </DialogTitle>
            <DialogDescription>
              This will create a user account for the dentist and activate their listing.
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <div className="py-4 space-y-4">
              {(() => {
                const listingData = parseListingData(selectedLead.message);
                return (
                  <>
                    <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-bold">{listingData?.clinicName || selectedLead.patient_name}</p>
                          <p className="text-sm text-muted-foreground">{listingData?.dentistName}</p>
                        </div>
                      </div>
                      
                      {listingData?.city && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {listingData.city}, {listingData.state}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {selectedLead.patient_email}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {selectedLead.patient_phone}
                      </div>

                      {listingData?.website && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Globe className="h-4 w-4" />
                          {listingData.website}
                        </div>
                      )}

                      {listingData?.services?.length > 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <Stethoscope className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex flex-wrap gap-1">
                            {listingData.services.slice(0, 5).map((s: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                            {listingData.services.length > 5 && (
                              <Badge variant="outline" className="text-xs">+{listingData.services.length - 5} more</Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <h4 className="font-semibold mb-2">Upon Approval:</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          User account created with temporary password
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          Email sent with login credentials
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          SMS confirmation sent to phone
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          Clinic profile created and linked
                        </li>
                      </ul>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)} disabled={isApproving}>
              Cancel
            </Button>
            <Button onClick={handleApproveListing} disabled={isApproving}>
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <BadgeCheck className="h-4 w-4 mr-2" />
                  Approve & Create Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
