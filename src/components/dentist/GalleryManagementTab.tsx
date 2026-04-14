import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Image,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Eye,
  EyeOff,
  Calendar,
  User,
  Stethoscope,
  GripVertical,
  Check,
  X,
  Sparkles,
  Edit,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { NoPracticeLinked } from './NoPracticeLinked';

interface BeforeAfterCase {
  id: string;
  clinic_id: string;
  patient_name: string | null;
  treatment_id: string | null;
  description: string | null;
  before_image_url: string;
  after_image_url: string;
  case_date: string | null;
  is_public: boolean;
  treatment?: { id: string; name: string } | null;
}

export default function GalleryManagementTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddingCase, setIsAddingCase] = useState(false);
  const [editingCase, setEditingCase] = useState<BeforeAfterCase | null>(null);
  const [patientName, setPatientName] = useState('');
  const [selectedTreatment, setSelectedTreatment] = useState<string>('');
  const [description, setDescription] = useState('');
  const [caseDate, setCaseDate] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [beforeImage, setBeforeImage] = useState('');
  const [afterImage, setAfterImage] = useState('');

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-gallery', user?.id],
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

  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ['before-after-cases', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_before_after')
        .select('*, treatment:treatments(id, name)')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BeforeAfterCase[];
    },
    enabled: !!clinic?.id,
  });

  const { data: treatments } = useQuery({
    queryKey: ['clinic-treatments', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_treatments')
        .select('treatment_id, treatment:treatments(id, name)')
        .eq('clinic_id', clinic?.id);
      return data?.map(d => d.treatment).filter(Boolean) || [];
    },
    enabled: !!clinic?.id,
  });

  const addCase = useMutation({
    mutationFn: async () => {
      if (!clinic?.id || !beforeImage || !afterImage) {
        throw new Error('Please upload both before and after images');
      }
      const { error } = await supabase.from('clinic_before_after').insert({
        clinic_id: clinic.id,
        patient_name: patientName || null,
        treatment_id: selectedTreatment || null,
        description: description || null,
        case_date: caseDate || null,
        is_public: isPublic,
        before_image_url: beforeImage,
        after_image_url: afterImage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['before-after-cases'] });
      setIsAddingCase(false);
      resetForm();
      toast.success('Case added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add case');
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from('clinic_before_after')
        .update({ is_public: isPublic })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['before-after-cases'] });
      toast.success('Visibility updated');
    },
  });

  const deleteCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clinic_before_after')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['before-after-cases'] });
      toast.success('Case deleted');
    },
  });

  const resetForm = () => {
    setPatientName('');
    setSelectedTreatment('');
    setDescription('');
    setCaseDate('');
    setIsPublic(true);
    setBeforeImage('');
    setAfterImage('');
  };

  const handleImageUrl = async (type: 'before' | 'after') => {
    const url = type === 'before' ? beforeImage : afterImage;
    if (type === 'before') {
      setBeforeImage(url);
    } else {
      setAfterImage(url);
    }
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  const publicCases = cases?.filter(c => c.is_public) || [];
  const privateCases = cases?.filter(c => !c.is_public) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
            <Image className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Before & After Gallery</h2>
            <p className="text-sm text-muted-foreground">
              {cases?.length || 0} cases • {publicCases.length} public
            </p>
          </div>
        </div>
        <Button onClick={() => setIsAddingCase(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Case
        </Button>
      </div>

      {/* Cases Grid */}
      {casesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : cases?.length === 0 ? (
        <Card className="border-2 border-dashed border-primary/20">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Image className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No Cases Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add before & after photos to showcase your work
            </p>
            <Button onClick={() => setIsAddingCase(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Case
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases?.map((c) => (
            <Card key={c.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="grid grid-cols-2 gap-0.5">
                <div className="relative aspect-square bg-muted">
                  {c.before_image_url && (
                    <img
                      src={c.before_image_url}
                      alt="Before"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <Badge className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px]">
                    Before
                  </Badge>
                </div>
                <div className="relative aspect-square bg-muted">
                  {c.after_image_url && (
                    <img
                      src={c.after_image_url}
                      alt="After"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <Badge className="absolute bottom-1 left-1 bg-primary text-white text-[10px]">
                    After
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {c.treatment && (
                      <Badge variant="secondary" className="text-xs mb-1">
                        {c.treatment.name}
                      </Badge>
                    )}
                    <p className="text-sm font-medium truncate">
                      {c.patient_name || 'Anonymous'}
                    </p>
                    {c.case_date && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.case_date), 'MMM yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleVisibility.mutate({ id: c.id, isPublic: !c.is_public })}
                    >
                      {c.is_public ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteCase.mutate(c.id)}
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

      {/* Add Case Dialog */}
      <Dialog open={isAddingCase} onOpenChange={setIsAddingCase}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Add Before & After Case
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Before Image URL</Label>
                <Input
                  placeholder="https://..."
                  value={beforeImage}
                  onChange={(e) => setBeforeImage(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>After Image URL</Label>
                <Input
                  placeholder="https://..."
                  value={afterImage}
                  onChange={(e) => setAfterImage(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Patient Name (optional)</Label>
              <Input
                placeholder="Enter patient name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Treatment</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                value={selectedTreatment}
                onChange={(e) => setSelectedTreatment(e.target.value)}
              >
                <option value="">Select treatment</option>
                {treatments?.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Case Date</Label>
              <Input
                type="date"
                value={caseDate}
                onChange={(e) => setCaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the case..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingCase(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addCase.mutate()}
              disabled={addCase.isPending || !beforeImage || !afterImage}
            >
              {addCase.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}