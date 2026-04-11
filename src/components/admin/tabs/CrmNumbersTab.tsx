import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Phone,
  Plus,
  Edit,
  Trash2,
  Building2,
  CheckCircle,
  XCircle,
  MessageSquare,
  Loader2,
} from 'lucide-react';

interface CrmNumber {
  id: string;
  clinic_id: string | null;
  phone_number: string;
  provider: string;
  is_active: boolean;
  is_whatsapp_enabled: boolean;
  assigned_at: string | null;
  created_at: string;
  clinic?: { id: string; name: string } | null;
}

interface Clinic {
  id: string;
  name: string;
}

export default function CrmNumbersTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmNumber | null>(null);
  const [form, setForm] = useState({
    phone_number: '',
    provider: 'twilio',
    clinic_id: '',
    is_whatsapp_enabled: false,
  });

  // Fetch CRM numbers
  const { data: numbers, isLoading } = useQuery({
    queryKey: ['admin-crm-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_numbers')
        .select('*, clinic:clinics(id, name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CrmNumber[];
    },
  });

  // Fetch clinics for assignment
  const { data: clinics } = useQuery({
    queryKey: ['clinics-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claim_status', 'claimed')
        .order('name');

      if (error) throw error;
      return data as Clinic[];
    },
  });

  // Create number mutation
  const createNumber = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('crm_numbers').insert({
        phone_number: form.phone_number,
        provider: form.provider,
        clinic_id: form.clinic_id || null,
        is_whatsapp_enabled: form.is_whatsapp_enabled,
        assigned_at: form.clinic_id ? new Date().toISOString() : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-crm-numbers'] });
      setDialogOpen(false);
      resetForm();
      toast.success('CRM number added');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add number'),
  });

  // Update number mutation
  const updateNumber = useMutation({
    mutationFn: async () => {
      if (!editing) return;

      const { error } = await supabase
        .from('crm_numbers')
        .update({
          phone_number: form.phone_number,
          provider: form.provider,
          clinic_id: form.clinic_id || null,
          is_whatsapp_enabled: form.is_whatsapp_enabled,
          assigned_at: form.clinic_id && !editing.assigned_at 
            ? new Date().toISOString() 
            : editing.assigned_at,
        })
        .eq('id', editing.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-crm-numbers'] });
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      toast.success('CRM number updated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('crm_numbers')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-crm-numbers'] });
    },
  });

  // Delete number mutation
  const deleteNumber = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_numbers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-crm-numbers'] });
      toast.success('CRM number deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  });

  const resetForm = () => {
    setForm({
      phone_number: '',
      provider: 'twilio',
      clinic_id: '',
      is_whatsapp_enabled: false,
    });
  };

  const openEdit = (num: CrmNumber) => {
    setEditing(num);
    setForm({
      phone_number: num.phone_number,
      provider: num.provider,
      clinic_id: num.clinic_id || '',
      is_whatsapp_enabled: num.is_whatsapp_enabled,
    });
    setDialogOpen(true);
  };

  const stats = {
    total: numbers?.length || 0,
    active: numbers?.filter((n) => n.is_active).length || 0,
    assigned: numbers?.filter((n) => n.clinic_id).length || 0,
    whatsapp: numbers?.filter((n) => n.is_whatsapp_enabled).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">CRM Numbers</h1>
          <p className="text-muted-foreground mt-1">Manage virtual phone numbers for SMS/WhatsApp</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Number
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit CRM Number' : 'Add CRM Number'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  placeholder="+971 4 XXX XXXX"
                />
              </div>

              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(value) => setForm({ ...form, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="vonage">Vonage</SelectItem>
                    <SelectItem value="messagebird">MessageBird</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign to Clinic</Label>
                <Select
                  value={form.clinic_id}
                  onValueChange={(value) => setForm({ ...form, clinic_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select clinic (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {clinics?.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>WhatsApp Enabled</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable WhatsApp messaging on this number
                  </p>
                </div>
                <Switch
                  checked={form.is_whatsapp_enabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_whatsapp_enabled: checked })
                  }
                />
              </div>

              <Button
                className="w-full"
                onClick={() => (editing ? updateNumber.mutate() : createNumber.mutate())}
                disabled={createNumber.isPending || updateNumber.isPending}
              >
                {(createNumber.isPending || updateNumber.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editing ? 'Update Number' : 'Add Number'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Numbers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.assigned}</p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.whatsapp}</p>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Numbers Table */}
      <Card>
        <CardHeader>
          <CardTitle>CRM Phone Numbers</CardTitle>
          <CardDescription>Virtual numbers for clinic messaging</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : numbers && numbers.length > 0 ? (
                numbers.map((num) => (
                  <TableRow key={num.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">{num.phone_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {num.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {num.clinic ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{num.clinic.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {num.is_whatsapp_enabled ? (
                        <Badge className="bg-teal-100 text-teal-800">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={num.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: num.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {num.assigned_at
                        ? format(new Date(num.assigned_at), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(num)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteNumber.mutate(num.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No CRM numbers configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
