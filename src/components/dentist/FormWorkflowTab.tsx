import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDentistClinic } from '@/hooks/useDentistClinic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  FileText,
  GripVertical,
  Mail,
  Plus,
  Save,
  Settings,
  Trash2,
  Workflow,
  Shield,
  Globe,
  HardDrive,
  Zap,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface FormSequenceItem {
  form_template_id: string;
  delay_hours: number;
  delivery_method: 'email' | 'whatsapp' | 'dashboard';
}

interface WorkflowSettings {
  id?: string;
  name: string;
  is_active: boolean;
  trigger_event: 'booking_confirmed' | 'booking_pending' | 'manual';
  form_sequence: FormSequenceItem[];
  delivery_destinations: {
    email: boolean;
    dashboard: boolean;
    google_drive: boolean;
  };
  require_otp_verification: boolean;
  capture_ip_address: boolean;
}

const TRIGGER_OPTIONS = [
  { value: 'booking_confirmed', label: 'When Booking is Confirmed', icon: CheckCircle },
  { value: 'booking_pending', label: 'When Booking Request Received', icon: Clock },
  { value: 'manual', label: 'Manual Send Only', icon: Settings },
];

export default function FormWorkflowTab() {
  const queryClient = useQueryClient();
  const { data: clinic, isLoading: clinicLoading } = useDentistClinic();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowSettings | null>(null);

  // Fetch form templates
  const { data: templates } = useQuery({
    queryKey: ['intake-templates-for-workflow', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('intake_form_templates')
        .select('id, name, form_type')
        .or(`clinic_id.eq.${clinic?.id},clinic_id.is.null`)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch existing workflows
  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ['form-workflows', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_workflow_settings')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at');
      
      if (error) throw error;
      return (data || []).map((w: any) => ({
        ...w,
        form_sequence: (w.form_sequence || []) as FormSequenceItem[],
        delivery_destinations: (w.delivery_destinations || { email: true, dashboard: true, google_drive: false }) as WorkflowSettings['delivery_destinations'],
        trigger_event: w.trigger_event as WorkflowSettings['trigger_event'],
      })) as WorkflowSettings[];
    },
    enabled: !!clinic?.id,
  });

  // Save workflow
  const saveWorkflow = useMutation({
    mutationFn: async (workflow: WorkflowSettings) => {
      if (workflow.id) {
        const { error } = await supabase
          .from('form_workflow_settings')
          .update({
            name: workflow.name,
            is_active: workflow.is_active,
            trigger_event: workflow.trigger_event,
            form_sequence: workflow.form_sequence as any,
            delivery_destinations: workflow.delivery_destinations as any,
            require_otp_verification: workflow.require_otp_verification,
            capture_ip_address: workflow.capture_ip_address,
          })
          .eq('id', workflow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('form_workflow_settings')
          .insert({
            clinic_id: clinic?.id,
            name: workflow.name,
            is_active: workflow.is_active,
            trigger_event: workflow.trigger_event,
            form_sequence: workflow.form_sequence as any,
            delivery_destinations: workflow.delivery_destinations as any,
            require_otp_verification: workflow.require_otp_verification,
            capture_ip_address: workflow.capture_ip_address,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Workflow saved');
      queryClient.invalidateQueries({ queryKey: ['form-workflows'] });
      setEditModalOpen(false);
      setEditingWorkflow(null);
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  // Delete workflow
  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('form_workflow_settings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Workflow deleted');
      queryClient.invalidateQueries({ queryKey: ['form-workflows'] });
    },
  });

  const openNewWorkflow = () => {
    setEditingWorkflow({
      name: 'New Workflow',
      is_active: true,
      trigger_event: 'booking_confirmed',
      form_sequence: [],
      delivery_destinations: { email: true, dashboard: true, google_drive: false },
      require_otp_verification: false,
      capture_ip_address: true,
    });
    setEditModalOpen(true);
  };

  const addFormToSequence = () => {
    if (!editingWorkflow) return;
    setEditingWorkflow({
      ...editingWorkflow,
      form_sequence: [
        ...editingWorkflow.form_sequence,
        { form_template_id: '', delay_hours: 0, delivery_method: 'email' },
      ],
    });
  };

  const updateFormInSequence = (index: number, updates: Partial<FormSequenceItem>) => {
    if (!editingWorkflow) return;
    const newSequence = [...editingWorkflow.form_sequence];
    newSequence[index] = { ...newSequence[index], ...updates };
    setEditingWorkflow({ ...editingWorkflow, form_sequence: newSequence });
  };

  const removeFormFromSequence = (index: number) => {
    if (!editingWorkflow) return;
    setEditingWorkflow({
      ...editingWorkflow,
      form_sequence: editingWorkflow.form_sequence.filter((_, i) => i !== index),
    });
  };

  const moveFormInSequence = (index: number, direction: 'up' | 'down') => {
    if (!editingWorkflow) return;
    const newSequence = [...editingWorkflow.form_sequence];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newSequence.length) return;
    [newSequence[index], newSequence[newIndex]] = [newSequence[newIndex], newSequence[index]];
    setEditingWorkflow({ ...editingWorkflow, form_sequence: newSequence });
  };

  if (clinicLoading || workflowsLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!clinic) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Practice Linked</h3>
          <p className="text-muted-foreground">
            You need to claim or create a practice to configure workflows
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6" />
            Form Automation Workflows
          </h2>
          <p className="text-muted-foreground">
            Design automated form sequences that trigger based on booking events
          </p>
        </div>
        <Button onClick={openNewWorkflow} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      {/* Existing Workflows */}
      {workflows?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Workflows Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first automation workflow to send forms automatically
            </p>
            <Button onClick={openNewWorkflow}>Create Workflow</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows?.map((workflow) => (
            <Card key={workflow.id} className={workflow.is_active ? '' : 'opacity-60'}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      workflow.is_active ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Zap className={`h-6 w-6 ${workflow.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{workflow.name}</h3>
                        {workflow.is_active ? (
                          <Badge variant="default" className="bg-teal text-white">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Trigger: {TRIGGER_OPTIONS.find(t => t.value === workflow.trigger_event)?.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {workflow.form_sequence?.length || 0} forms in sequence
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingWorkflow(workflow);
                        setEditModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('Delete this workflow?')) {
                          deleteWorkflow.mutate(workflow.id!);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Workflow Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow?.id ? 'Edit Workflow' : 'Create Workflow'}
            </DialogTitle>
            <DialogDescription>
              Design your form automation sequence
            </DialogDescription>
          </DialogHeader>

          {editingWorkflow && (
            <div className="space-y-6 py-4">
              {/* Basic Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Workflow Name</Label>
                  <Input
                    value={editingWorkflow.name}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                    placeholder="e.g., New Patient Intake"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={editingWorkflow.is_active}
                      onCheckedChange={(checked) => setEditingWorkflow({ ...editingWorkflow, is_active: checked })}
                    />
                    <span className="text-sm">{editingWorkflow.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>

              {/* Trigger Event */}
              <div className="space-y-2">
                <Label>Trigger Event</Label>
                <Select
                  value={editingWorkflow.trigger_event}
                  onValueChange={(value: 'booking_confirmed' | 'booking_pending' | 'manual') => 
                    setEditingWorkflow({ ...editingWorkflow, trigger_event: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-4 w-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Form Sequence */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Form Sequence</Label>
                  <Button variant="outline" size="sm" onClick={addFormToSequence} className="gap-1">
                    <Plus className="h-3 w-3" />
                    Add Form
                  </Button>
                </div>

                {editingWorkflow.form_sequence.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No forms added yet</p>
                    <Button variant="link" size="sm" onClick={addFormToSequence}>
                      Add your first form
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingWorkflow.form_sequence.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveFormInSequence(index, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveFormInSequence(index, 'down')}
                            disabled={index === editingWorkflow.form_sequence.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <Badge variant="outline" className="h-6 w-6 flex items-center justify-center p-0">
                          {index + 1}
                        </Badge>

                        <Select
                          value={item.form_template_id}
                          onValueChange={(value) => updateFormInSequence(index, { form_template_id: value })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select form..." />
                          </SelectTrigger>
                          <SelectContent>
                            {templates?.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            className="w-16"
                            value={item.delay_hours}
                            onChange={(e) => updateFormInSequence(index, { delay_hours: parseInt(e.target.value) || 0 })}
                            min={0}
                          />
                          <span className="text-sm text-muted-foreground">hrs</span>
                        </div>

                        <Select
                          value={item.delivery_method}
                          onValueChange={(value: 'email' | 'whatsapp' | 'dashboard') => 
                            updateFormInSequence(index, { delivery_method: value })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="dashboard">Dashboard Link</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeFormFromSequence(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Destinations */}
              <div className="space-y-3">
                <Label>Signed Form Delivery</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Switch
                      checked={editingWorkflow.delivery_destinations.email}
                      onCheckedChange={(checked) => setEditingWorkflow({
                        ...editingWorkflow,
                        delivery_destinations: { ...editingWorkflow.delivery_destinations, email: checked }
                      })}
                    />
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Email</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Switch
                      checked={editingWorkflow.delivery_destinations.dashboard}
                      onCheckedChange={(checked) => setEditingWorkflow({
                        ...editingWorkflow,
                        delivery_destinations: { ...editingWorkflow.delivery_destinations, dashboard: checked }
                      })}
                    />
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 border rounded-lg opacity-50">
                    <Switch
                      checked={editingWorkflow.delivery_destinations.google_drive}
                      onCheckedChange={(checked) => setEditingWorkflow({
                        ...editingWorkflow,
                        delivery_destinations: { ...editingWorkflow.delivery_destinations, google_drive: checked }
                      })}
                      disabled
                    />
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Google Drive</span>
                    <Badge variant="secondary" className="text-[10px]">Soon</Badge>
                  </div>
                </div>
              </div>

              {/* Security Options */}
              <div className="space-y-3">
                <Label>Security & Consent</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Require OTP Verification</p>
                        <p className="text-xs text-muted-foreground">
                          Patient must verify via OTP before signing
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={editingWorkflow.require_otp_verification}
                      onCheckedChange={(checked) => setEditingWorkflow({
                        ...editingWorkflow, require_otp_verification: checked
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Capture IP Address</p>
                        <p className="text-xs text-muted-foreground">
                          Record IP address for consent proof
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={editingWorkflow.capture_ip_address}
                      onCheckedChange={(checked) => setEditingWorkflow({
                        ...editingWorkflow, capture_ip_address: checked
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => editingWorkflow && saveWorkflow.mutate(editingWorkflow)}
              disabled={saveWorkflow.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveWorkflow.isPending ? 'Saving...' : 'Save Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
