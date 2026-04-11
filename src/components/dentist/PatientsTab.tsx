import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Users, Search, Phone, Mail, MessageSquare, Calendar, Plus, Eye, Send, Upload, Download, 
  ChevronRight, Sparkles, Star, UserPlus, MoreHorizontal, MessageCircle, FileText, Loader2 
} from 'lucide-react';
import { NoPracticeLinked } from './NoPracticeLinked';
import { cn } from '@/lib/utils';

// Message Templates
const MESSAGE_TEMPLATES = [
  { id: 'review_request', name: 'Review Request', icon: Star, description: 'Ask for a review after visit' },
  { id: 'follow_up', name: 'Follow-up', icon: MessageSquare, description: 'Check in after treatment' },
  { id: 'appointment_reminder', name: 'Appointment Reminder', icon: Calendar, description: 'Remind about upcoming appointment' },
  { id: 'thank_you', name: 'Thank You', icon: Sparkles, description: 'Thank patient for their visit' },
];

interface Patient {
  id: string;
  clinic_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  source: string | null;
  first_visit_at: string | null;
  last_visit_at: string | null;
  total_visits: number;
  is_opted_in_sms: boolean;
  is_opted_in_whatsapp: boolean;
  created_at: string;
  // Extended fields
  insurance_provider: string | null;
  insurance_member_id: string | null;
  address: string | null;
  date_of_birth: string | null;
  documents: unknown; // JSON array
  medical_notes: string | null;
  preferred_contact: string | null;
  is_deleted_by_dentist?: boolean;
}

// Templates for sending
const SEND_TEMPLATES = [
  { id: 'review_request', name: 'Review Request', icon: Star },
  { id: 'follow_up', name: 'Follow-up', icon: MessageSquare },
  { id: 'appointment_reminder', name: 'Appointment Reminder', icon: Calendar },
  { id: 'thank_you', name: 'Thank You', icon: Sparkles },
  { id: 'reschedule', name: 'Reschedule Request', icon: Calendar },
];

export default function PatientsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [sendRequestDialog, setSendRequestDialog] = useState(false);
  const [requestPatient, setRequestPatient] = useState<Patient | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('review_request');
  const [sendChannel, setSendChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [isSending, setIsSending] = useState(false);
  const [filterVisits, setFilterVisits] = useState<string>('all');
  const [filterOptIn, setFilterOptIn] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    is_opted_in_sms: true,
    is_opted_in_whatsapp: true,
    insurance_provider: '',
    insurance_member_id: '',
    address: '',
    date_of_birth: '',
    medical_notes: '',
    preferred_contact: 'phone',
  });

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-patients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch patients (hide soft-deleted)
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ['clinic-patients', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .or('is_deleted_by_dentist.is.null,is_deleted_by_dentist.eq.false')
        .order('last_visit_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!clinic?.id,
  });

  // Add patient mutation
  const addPatient = useMutation({
    mutationFn: async (patient: typeof newPatient) => {
      if (!clinic?.id) throw new Error('No clinic found');
      if (!patient.name.trim()) throw new Error('Name is required');
      if (!patient.phone.trim()) throw new Error('Phone is required');

      const { error } = await supabase.from('patients').insert({
        clinic_id: clinic.id,
        name: patient.name.trim(),
        phone: patient.phone.trim(),
        email: patient.email.trim() || null,
        notes: patient.notes.trim() || null,
        is_opted_in_sms: patient.is_opted_in_sms,
        is_opted_in_whatsapp: patient.is_opted_in_whatsapp,
        source: 'manual',
        insurance_provider: patient.insurance_provider.trim() || null,
        insurance_member_id: patient.insurance_member_id.trim() || null,
        address: patient.address.trim() || null,
        date_of_birth: patient.date_of_birth || null,
        medical_notes: patient.medical_notes.trim() || null,
        preferred_contact: patient.preferred_contact,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Patient added');
      setAddDialogOpen(false);
      setNewPatient({ 
        name: '', phone: '', email: '', notes: '', 
        is_opted_in_sms: true, is_opted_in_whatsapp: true,
        insurance_provider: '', insurance_member_id: '', address: '',
        date_of_birth: '', medical_notes: '', preferred_contact: 'phone'
      });
      queryClient.invalidateQueries({ queryKey: ['clinic-patients'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add'),
  });

  // Update patient mutation
  const updatePatient = useMutation({
    mutationFn: async (patient: Partial<Patient> & { id: string }) => {
      const { documents, ...updateData } = patient;
      const { error } = await supabase
        .from('patients')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', patient.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Patient updated');
      setEditPatient(null);
      setSelectedPatient(null);
      queryClient.invalidateQueries({ queryKey: ['clinic-patients'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  // Soft delete patient mutation (hides from dentist but keeps in DB for super admin)
  const softDeletePatient = useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase
        .from('patients')
        .update({ 
          is_deleted_by_dentist: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq('id', patientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Patient removed from your list');
      setSelectedPatient(null);
      queryClient.invalidateQueries({ queryKey: ['clinic-patients'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to remove'),
  });

  // CSV import
  const importCSV = useMutation({
    mutationFn: async (file: File) => {
      if (!clinic?.id) throw new Error('No clinic');
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) throw new Error('CSV must have data');

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const nameIdx = headers.findIndex(h => h.includes('name'));
      const phoneIdx = headers.findIndex(h => h.includes('phone'));
      const emailIdx = headers.findIndex(h => h.includes('email'));

      if (nameIdx === -1 || phoneIdx === -1) throw new Error('Need name and phone columns');

      const patientsToAdd: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values[nameIdx] && values[phoneIdx]) {
          patientsToAdd.push({
            clinic_id: clinic.id,
            name: values[nameIdx],
            phone: values[phoneIdx],
            email: emailIdx !== -1 ? values[emailIdx] || null : null,
            source: 'csv_import',
            is_opted_in_sms: true,
            is_opted_in_whatsapp: true,
          });
        }
      }

      if (patientsToAdd.length === 0) throw new Error('No valid patients');
      const { error } = await supabase.from('patients').insert(patientsToAdd);
      if (error) throw error;
      return patientsToAdd.length;
    },
    onSuccess: (count) => {
      toast.success(`Imported ${count} patients`);
      setCsvDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['clinic-patients'] });
    },
    onError: (e: any) => toast.error(e.message || 'Import failed'),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importCSV.mutate(file);
  };

  const downloadTemplate = () => {
    const csv = 'name,phone,email\n"John Doe","+1234567890","john@example.com"';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patients_template.csv';
    a.click();
  };

  // Send review request to patient
  const sendReviewRequest = async (patient: Patient, channel: 'email' | 'sms' | 'whatsapp') => {
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-review-request', {
        body: {
          clinicId: clinic?.id,
          recipientName: patient.name,
          recipientEmail: channel === 'email' ? patient.email : undefined,
          recipientPhone: channel !== 'email' ? patient.phone : undefined,
          channel,
        },
      });
      if (error) throw error;
      toast.success(`Review request sent to ${patient.name}!`);
      setSendRequestDialog(false);
      setRequestPatient(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setIsSending(false);
    }
  };

  const openSendRequestDialog = (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setRequestPatient(patient);
    setSendRequestDialog(true);
  };

  // Apply filters
  const filteredPatients = patients?.filter((p) => {
    const matchesSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesVisits = filterVisits === 'all' ||
      (filterVisits === 'new' && p.total_visits <= 1) ||
      (filterVisits === 'returning' && p.total_visits > 1) ||
      (filterVisits === 'vip' && p.total_visits > 5);
    
    const matchesOptIn = filterOptIn === 'all' ||
      (filterOptIn === 'sms' && p.is_opted_in_sms) ||
      (filterOptIn === 'whatsapp' && p.is_opted_in_whatsapp) ||
      (filterOptIn === 'email' && p.email);

    return matchesSearch && matchesVisits && matchesOptIn;
  });

  // Stats
  const stats = {
    total: patients?.length || 0,
    smsOptIn: patients?.filter(p => p.is_opted_in_sms).length || 0,
    returning: patients?.filter(p => p.total_visits > 1).length || 0,
    vip: patients?.filter(p => p.total_visits > 5).length || 0,
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!clinic) return <NoPracticeLinked compact />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Patients</h1>
          <p className="text-muted-foreground">Your patient database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvDialogOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Patient
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-slate-300">Total Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary to-teal text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.smsOptIn}</p>
                <p className="text-xs text-teal-100">SMS Opted In</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.returning}</p>
                <p className="text-xs text-emerald-100">Returning</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gold to-amber-500 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.vip}</p>
                <p className="text-xs text-amber-100">VIP (5+ visits)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10 rounded-xl bg-background"
                placeholder="Search patients by name, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={filterVisits} onValueChange={setFilterVisits}>
              <SelectTrigger className="w-[130px] rounded-xl">
                <SelectValue placeholder="Visits" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patients</SelectItem>
                <SelectItem value="new">New (1 visit)</SelectItem>
                <SelectItem value="returning">Returning</SelectItem>
                <SelectItem value="vip">VIP (5+)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterOptIn} onValueChange={setFilterOptIn}>
              <SelectTrigger className="w-[130px] rounded-xl">
                <SelectValue placeholder="Opt-in" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sms">SMS Opted</SelectItem>
                <SelectItem value="whatsapp">WhatsApp Opted</SelectItem>
                <SelectItem value="email">Has Email</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || filterVisits !== 'all' || filterOptIn !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setSearchQuery(''); setFilterVisits('all'); setFilterOptIn('all'); }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      <Card className="card-modern overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-teal/5 border-b">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Patients ({filteredPatients?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {patientsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filteredPatients && filteredPatients.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/30 cursor-pointer transition-colors group"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <Avatar className="h-12 w-12 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground">{patient.name}</p>
                        {patient.total_visits > 5 && (
                          <Badge className="bg-gold/10 text-gold border-0 text-xs">
                            <Star className="h-3 w-3 mr-1" />VIP
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {patient.phone}
                        </span>
                        {patient.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {patient.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{patient.total_visits} visits</Badge>
                      {patient.is_opted_in_sms && <Badge variant="outline" className="text-xs text-primary">SMS</Badge>}
                    </div>
                    
                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Send Request</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {patient.email && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); sendReviewRequest(patient, 'email'); }}>
                            <Mail className="h-4 w-4 mr-2 text-blue-500" />
                            Review via Email
                          </DropdownMenuItem>
                        )}
                        {patient.is_opted_in_sms && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); sendReviewRequest(patient, 'sms'); }}>
                            <Phone className="h-4 w-4 mr-2 text-teal-500" />
                            Review via SMS
                          </DropdownMenuItem>
                        )}
                        {patient.is_opted_in_whatsapp && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); sendReviewRequest(patient, 'whatsapp'); }}>
                            <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                            Review via WhatsApp
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium mb-1">No patients yet</p>
              <p className="text-sm text-muted-foreground">Patients are auto-created from bookings</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Detail Dialog - Enhanced */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>View and manage patient information</DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {selectedPatient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-xl font-semibold">{selectedPatient.name}</p>
                  <p className="text-muted-foreground">{selectedPatient.phone}</p>
                  {selectedPatient.email && (
                    <p className="text-sm text-muted-foreground">{selectedPatient.email}</p>
                  )}
                </div>
                {selectedPatient.total_visits > 5 && (
                  <Badge className="bg-gold/10 text-gold border-0">
                    <Star className="h-3 w-3 mr-1" />VIP
                  </Badge>
                )}
              </div>

              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Total Visits</p>
                  <p className="font-medium text-sm">{selectedPatient.total_visits}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Preferred Contact</p>
                  <p className="font-medium text-sm capitalize">{selectedPatient.preferred_contact || 'Phone'}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">First Visit</p>
                  <p className="font-medium text-sm">
                    {selectedPatient.first_visit_at ? format(new Date(selectedPatient.first_visit_at), 'MMM d, yyyy') : 'N/A'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Last Visit</p>
                  <p className="font-medium text-sm">
                    {selectedPatient.last_visit_at ? format(new Date(selectedPatient.last_visit_at), 'MMM d, yyyy') : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Insurance Info */}
              {(selectedPatient.insurance_provider || selectedPatient.insurance_member_id) && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">Insurance Information</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Provider</p>
                      <p className="text-sm font-medium">{selectedPatient.insurance_provider || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Member ID</p>
                      <p className="text-sm font-medium">{selectedPatient.insurance_member_id || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Address */}
              {selectedPatient.address && (
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Address</p>
                  <p className="text-sm">{selectedPatient.address}</p>
                </div>
              )}

              {/* Notes */}
              {selectedPatient.notes && (
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedPatient.notes}</p>
                </div>
              )}

              {/* Medical Notes */}
              {selectedPatient.medical_notes && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1 font-medium">Medical Notes</p>
                  <p className="text-sm">{selectedPatient.medical_notes}</p>
                </div>
              )}

              {/* Opt-in Status */}
              <div className="flex items-center gap-3">
                <Badge variant={selectedPatient.is_opted_in_sms ? 'default' : 'secondary'} className="text-xs">
                  {selectedPatient.is_opted_in_sms ? 'SMS ✓' : 'SMS ✗'}
                </Badge>
                <Badge variant={selectedPatient.is_opted_in_whatsapp ? 'default' : 'secondary'} className="text-xs">
                  {selectedPatient.is_opted_in_whatsapp ? 'WhatsApp ✓' : 'WhatsApp ✗'}
                </Badge>
                <Badge variant={selectedPatient.email ? 'default' : 'secondary'} className="text-xs">
                  {selectedPatient.email ? 'Email ✓' : 'No Email'}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => selectedPatient && softDeletePatient.mutate(selectedPatient.id)}
              disabled={softDeletePatient.isPending}
            >
              Remove
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setSelectedPatient(null)}>Close</Button>
            <Button 
              size="sm" 
              className="gap-2"
              onClick={() => {
                if (selectedPatient) {
                  setRequestPatient(selectedPatient);
                  setSendRequestDialog(true);
                  setSelectedPatient(null);
                }
              }}
            >
              <Send className="h-4 w-4" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Patient Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add New Patient
            </DialogTitle>
            <DialogDescription>Add a patient to your database</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="John Doe"
                value={newPatient.name}
                onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                placeholder="+1 (555) 123-4567"
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={newPatient.email}
                onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes about this patient..."
                value={newPatient.notes}
                onChange={(e) => setNewPatient({ ...newPatient, notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>SMS Opt-in</Label>
              <Switch
                checked={newPatient.is_opted_in_sms}
                onCheckedChange={(v) => setNewPatient({ ...newPatient, is_opted_in_sms: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addPatient.mutate(newPatient)}
              disabled={!newPatient.name || !newPatient.phone || addPatient.isPending}
            >
              Add Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Import Patients
            </DialogTitle>
            <DialogDescription>Upload a CSV file with patient data</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-xl p-8 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-4">Upload CSV with name, phone, email columns</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Select File
              </Button>
            </div>
            <Button variant="ghost" onClick={downloadTemplate} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
