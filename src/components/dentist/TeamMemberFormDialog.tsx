import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Upload, Users } from 'lucide-react';

export const PROFESSIONAL_TYPES = [
  { value: 'dentist', label: 'Dentist' },
  { value: 'orthodontist', label: 'Orthodontist' },
  { value: 'endodontist', label: 'Endodontist' },
  { value: 'periodontist', label: 'Periodontist' },
  { value: 'prosthodontist', label: 'Prosthodontist' },
  { value: 'oral_surgeon', label: 'Oral Surgeon' },
  { value: 'pediatric_dentist', label: 'Pediatric Dentist' },
  { value: 'hygienist', label: 'Dental Hygienist' },
  { value: 'assistant', label: 'Dental Assistant' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'practice_manager', label: 'Practice Manager' },
];

export interface TeamMemberFormData {
  name: string;
  title: string;
  professional_type: string;
  is_primary: boolean;
  license_number: string;
  department: string;
  email: string;
  phone: string;
  bio: string;
  years_experience: number;
  image_url: string;
}

interface TeamMemberFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  clinicId: string | undefined;
  formData: TeamMemberFormData;
  onFormChange: (data: TeamMemberFormData) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isEdit: boolean;
}

export function TeamMemberFormDialog({
  isOpen,
  onClose,
  title,
  clinicId,
  formData,
  onFormChange,
  onSubmit,
  isSubmitting,
  isEdit,
}: TeamMemberFormDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !clinicId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clinicId}/team-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('clinic-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clinic-assets')
        .getPublicUrl(fileName);

      onFormChange({ ...formData, image_url: publicUrl });
      toast.success('Photo uploaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFieldChange = (field: keyof TeamMemberFormData, value: any) => {
    onFormChange({ ...formData, [field]: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Add doctors, hygienists, and support staff to your practice
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Photo Upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {formData.image_url ? (
                <Avatar className="h-20 w-20 border-2 border-border">
                  <AvatarImage src={formData.image_url} />
                  <AvatarFallback>
                    {formData.name.split(' ').map(n => n[0]).join('').slice(0, 2) || 'TM'}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Photo
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Recommended: 400x400px</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Dr. Ahmed Khan"
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Senior Dentist"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Professional Type *</Label>
              <Select 
                value={formData.professional_type} 
                onValueChange={(v) => handleFieldChange('professional_type', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFESSIONAL_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={formData.department}
                onChange={(e) => handleFieldChange('department', e.target.value)}
                placeholder="Cosmetic Dentistry"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>License Number</Label>
              <Input
                value={formData.license_number}
                onChange={(e) => handleFieldChange('license_number', e.target.value)}
                placeholder="DHA-XXX-XXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Years of Experience</Label>
              <Input
                type="number"
                value={formData.years_experience}
                onChange={(e) => handleFieldChange('years_experience', parseInt(e.target.value) || 0)}
                placeholder="10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                placeholder="doctor@clinic.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                placeholder="+971 50 XXX XXXX"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={formData.bio}
              onChange={(e) => handleFieldChange('bio', e.target.value)}
              placeholder="Brief professional background..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-gold-light/50 border border-gold/20">
            <div>
              <Label className="text-sm font-medium">Lead Practitioner</Label>
              <p className="text-xs text-muted-foreground">Mark as primary dentist/owner</p>
            </div>
            <Switch
              checked={formData.is_primary}
              onCheckedChange={(v) => handleFieldChange('is_primary', v)}
            />
          </div>

          <Button 
            className="w-full" 
            onClick={onSubmit}
            disabled={!formData.name || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {isEdit ? 'Update Team Member' : 'Add Team Member'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
