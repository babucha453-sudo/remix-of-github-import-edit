import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDentistClinic } from '@/hooks/useDentistClinic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  Stethoscope,
  Sparkles,
  Check,
  X,
  Calendar,
  Timer,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppointmentType {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_from: number | null;
  price_to: number | null;
  color: string | null;
  is_active: boolean;
  display_order: number | null;
}

const COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500', ring: 'ring-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { value: 'purple', label: 'Purple', class: 'bg-violet-500', ring: 'ring-violet-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500', ring: 'ring-orange-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500', ring: 'ring-pink-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500', ring: 'ring-teal-500' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500', ring: 'ring-amber-500' },
  { value: 'rose', label: 'Rose', class: 'bg-rose-500', ring: 'ring-rose-500' },
];

const DEFAULT_TYPES = [
  { name: 'New Patient Exam', duration: 60, color: 'blue', description: 'Comprehensive first-visit examination' },
  { name: 'Routine Cleaning', duration: 45, color: 'green', description: 'Professional dental cleaning' },
  { name: 'Emergency Visit', duration: 30, color: 'orange', description: 'Urgent dental care' },
  { name: 'Consultation', duration: 30, color: 'purple', description: 'Treatment planning discussion' },
  { name: 'Follow-up', duration: 15, color: 'teal', description: 'Post-treatment check' },
];

const DURATIONS = [
  { value: 15, label: '15 min', icon: '⚡' },
  { value: 30, label: '30 min', icon: '🕐' },
  { value: 45, label: '45 min', icon: '🕒' },
  { value: 60, label: '1 hour', icon: '🕓' },
  { value: 90, label: '1.5 hrs', icon: '🕕' },
  { value: 120, label: '2 hours', icon: '🕐' },
];

export default function AppointmentTypesTab() {
  const { data: clinic, isLoading: clinicLoading } = useDentistClinic();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingType, setEditingType] = useState<AppointmentType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    price_from: '',
    price_to: '',
    color: 'blue',
  });

  // Fetch appointment types
  const { data: appointmentTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['appointment-types', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_types')
        .select('*')
        .eq('clinic_id', clinic!.id)
        .order('display_order');

      if (error) throw error;
      return data as AppointmentType[];
    },
    enabled: !!clinic?.id,
  });

  // Create/Update appointment type
  const saveMutation = useMutation({
    mutationFn: async () => {
      const typeData = {
        clinic_id: clinic!.id,
        name: formData.name,
        description: formData.description || null,
        duration_minutes: formData.duration_minutes,
        price_from: formData.price_from ? parseFloat(formData.price_from) : null,
        price_to: formData.price_to ? parseFloat(formData.price_to) : null,
        color: formData.color,
        is_active: true,
      };

      if (editingType) {
        const { error } = await supabase
          .from('appointment_types')
          .update(typeData)
          .eq('id', editingType.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appointment_types')
          .insert(typeData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types', clinic?.id] });
      setShowDialog(false);
      resetForm();
      toast.success(editingType ? 'Service updated' : 'Service created');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save');
    },
  });

  // Toggle active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('appointment_types')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types', clinic?.id] });
      toast.success('Status updated');
    },
  });

  // Delete appointment type
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointment_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types', clinic?.id] });
      toast.success('Service deleted');
    },
  });

  // Initialize with defaults
  const initializeDefaults = async () => {
    if (!clinic?.id) return;

    const types = DEFAULT_TYPES.map((t, i) => ({
      clinic_id: clinic.id,
      name: t.name,
      description: t.description,
      duration_minutes: t.duration,
      color: t.color,
      is_active: true,
      display_order: i,
    }));

    const { error } = await supabase.from('appointment_types').insert(types);

    if (error) {
      toast.error('Failed to create default services');
    } else {
      queryClient.invalidateQueries({ queryKey: ['appointment-types', clinic.id] });
      toast.success('Default services created');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration_minutes: 30,
      price_from: '',
      price_to: '',
      color: 'blue',
    });
    setEditingType(null);
  };

  const openEditDialog = (type: AppointmentType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description || '',
      duration_minutes: type.duration_minutes,
      price_from: type.price_from?.toString() || '',
      price_to: type.price_to?.toString() || '',
      color: type.color || 'blue',
    });
    setShowDialog(true);
  };

  const getColorClass = (color: string | null) => {
    return COLORS.find(c => c.value === color)?.class || 'bg-primary';
  };

  if (clinicLoading || typesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64 bg-slate-700/50" />
          <Skeleton className="h-10 w-32 bg-slate-700/50" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-44 w-full bg-slate-700/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <Card className="bg-slate-800/90 border border-slate-700/50">
        <CardContent className="py-12 text-center">
          <Stethoscope className="h-12 w-12 mx-auto text-white/30 mb-4" />
          <p className="text-white/60">No clinic linked to your account</p>
        </CardContent>
      </Card>
    );
  }

  const activeCount = appointmentTypes?.filter(t => t.is_active).length || 0;
  const totalCount = appointmentTypes?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 p-5 rounded-2xl bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
            <Calendar className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">
              Appointment Types
            </h1>
            <p className="text-white/60 mt-1">
              Define the services patients can book online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50">
            <span className="text-2xl font-bold text-primary">{activeCount}</span>
            <span className="text-white/60 text-sm">/ {totalCount} active</span>
          </div>
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold">
                <Plus className="h-4 w-4" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-slate-900 border-slate-700/50">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {editingType ? 'Edit Service' : 'Create New Service'}
                </DialogTitle>
                <DialogDescription className="text-white/60">
                  Define a bookable service with duration and pricing
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label className="text-white">Service Name *</Label>
                  <Input
                    placeholder="e.g., Routine Cleaning"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-800 border-slate-600/50 text-white placeholder:text-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Description</Label>
                  <Textarea
                    placeholder="Brief description of the service..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="bg-slate-800 border-slate-600/50 text-white placeholder:text-white/40"
                  />
                </div>

                {/* Duration Selector */}
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Timer className="h-4 w-4 text-primary" />
                    Duration
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, duration_minutes: d.value })}
                        className={cn(
                          "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                          formData.duration_minutes === d.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-600/50 text-white/70 hover:border-slate-500"
                        )}
                      >
                        <span className="text-sm">{d.icon}</span>
                        <span className="font-medium text-sm">{d.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker */}
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    Color Tag
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c.value })}
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                          c.class,
                          formData.color === c.value 
                            ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110" 
                            : "hover:scale-105"
                        )}
                      >
                        {formData.color === c.value && <Check className="h-5 w-5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Price Range (Optional)
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={formData.price_from}
                        onChange={(e) => setFormData({ ...formData, price_from: e.target.value })}
                        className="pl-7 bg-slate-800 border-slate-600/50 text-white placeholder:text-white/40"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={formData.price_to}
                        onChange={(e) => setFormData({ ...formData, price_to: e.target.value })}
                        className="pl-7 bg-slate-800 border-slate-600/50 text-white placeholder:text-white/40"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDialog(false)}
                  className="border-slate-600/50 text-white hover:bg-slate-700/50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!formData.name || saveMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  {saveMutation.isPending ? (
                    <>Saving...</>
                  ) : editingType ? (
                    <>Update Service</>
                  ) : (
                    <>Create Service</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Services Grid */}
      {(!appointmentTypes || appointmentTypes.length === 0) ? (
        <Card className="bg-slate-800/90 border border-slate-700/50">
          <CardContent className="py-16 text-center">
            <div className="h-20 w-20 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-6">
              <Stethoscope className="h-10 w-10 text-white/30" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No services configured yet</h3>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              Create appointment types so patients can book specific services online
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={initializeDefaults} variant="outline" className="border-slate-600/50 text-white hover:bg-slate-700/50">
                <Sparkles className="h-4 w-4 mr-2" />
                Create Default Services
              </Button>
              <Button onClick={() => setShowDialog(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Service
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {appointmentTypes.map((type) => {
            const colorClass = getColorClass(type.color);

            return (
              <Card 
                key={type.id} 
                className={cn(
                  "bg-slate-800/90 border border-slate-700/50 overflow-hidden transition-all hover:border-slate-600/50 hover:shadow-lg group",
                  !type.is_active && "opacity-60"
                )}
              >
                {/* Color accent bar */}
                <div className={cn("h-1.5", colorClass)} />
                
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", colorClass)}>
                        <Stethoscope className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{type.name}</h3>
                        {!type.is_active && (
                          <Badge className="bg-slate-700 text-white/60 border-0 text-xs mt-1">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={type.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: type.id, isActive: checked })
                      }
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  {type.description && (
                    <p className="text-white/60 text-sm mb-4 line-clamp-2">
                      {type.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-white/70">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{type.duration_minutes} min</span>
                    </div>
                    {(type.price_from || type.price_to) && (
                      <div className="flex items-center gap-1 text-white/70">
                        <DollarSign className="h-4 w-4 text-teal" />
                        <span className="text-sm font-medium">
                          {type.price_from && type.price_to
                            ? `$${type.price_from} - $${type.price_to}`
                            : type.price_from
                              ? `From $${type.price_from}`
                              : `Up to $${type.price_to}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-700/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(type)}
                      className="flex-1 text-white/70 hover:text-white hover:bg-slate-700/50"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(type.id)}
                      className="text-coral/70 hover:text-coral hover:bg-coral/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add New Card */}
          <Card 
            className="bg-slate-800/50 border-2 border-dashed border-slate-600/50 hover:border-primary/50 cursor-pointer transition-all group"
            onClick={() => setShowDialog(true)}
          >
            <CardContent className="p-5 h-full flex flex-col items-center justify-center min-h-[200px]">
              <div className="h-14 w-14 rounded-xl bg-slate-700/50 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-7 w-7 text-white/50 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-white/60 font-medium group-hover:text-primary transition-colors">Add New Service</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
