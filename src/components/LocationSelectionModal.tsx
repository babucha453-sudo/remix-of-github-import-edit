import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, Loader2, AlertTriangle, Plus } from 'lucide-react';

interface LocationSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  detectedCity?: string | null;
  detectedCityId?: string | null;
  onLocationSelected?: () => void;
}

export function LocationSelectionModal({
  open,
  onOpenChange,
  clinicId,
  detectedCity,
  detectedCityId,
  onLocationSelected,
}: LocationSelectionModalProps) {
  const queryClient = useQueryClient();
  const [selectedCityId, setSelectedCityId] = useState<string | null>(detectedCityId || null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [showNewArea, setShowNewArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedCityId(detectedCityId || null);
      setSelectedAreaId(null);
      setShowNewArea(false);
      setNewAreaName('');
    }
  }, [open, detectedCityId]);

  // Fetch cities
  const { data: cities, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities-for-selection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch areas for selected city
  const { data: areas, isLoading: areasLoading } = useQuery({
    queryKey: ['areas-for-selection', selectedCityId],
    queryFn: async () => {
      if (!selectedCityId) return [];
      const { data, error } = await supabase
        .from('areas')
        .select('id, name, slug')
        .eq('city_id', selectedCityId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open && !!selectedCityId,
  });

  // Mutation to update clinic location
  const updateClinicLocation = useMutation({
    mutationFn: async ({ cityId, areaId }: { cityId: string; areaId: string | null }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          city_id: cityId,
          area_id: areaId,
          location_verified: true,
          location_pending_approval: false,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clinicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-clinic'] });
      toast.success('Location confirmed! Your clinic is now live.');
      onLocationSelected?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update location');
    },
  });

  // Mutation to submit new area request
  const submitNewArea = useMutation({
    mutationFn: async ({ cityId, areaName }: { cityId: string; areaName: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const slug = areaName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .trim();

      // Insert pending area request
      const { error: areaError } = await supabase.from('pending_areas').insert({
        clinic_id: clinicId,
        city_id: cityId,
        suggested_name: areaName,
        suggested_slug: slug,
        submitted_by: user.id,
        status: 'pending',
      });

      if (areaError) throw areaError;

      // Update clinic to mark location as pending
      const { error: clinicError } = await supabase
        .from('clinics')
        .update({
          city_id: cityId,
          location_verified: false,
          location_pending_approval: true,
          is_active: false, // Not live until approved
          updated_at: new Date().toISOString(),
        })
        .eq('id', clinicId);

      if (clinicError) throw clinicError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-clinic'] });
      toast.success('Area request submitted! Our team will review it shortly.');
      onLocationSelected?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit area request');
    },
  });

  const handleConfirmLocation = async () => {
    if (!selectedCityId) {
      toast.error('Please select a city');
      return;
    }

    if (showNewArea) {
      if (!newAreaName.trim()) {
        toast.error('Please enter an area name');
        return;
      }
      setIsSubmitting(true);
      await submitNewArea.mutateAsync({ cityId: selectedCityId, areaName: newAreaName.trim() });
      setIsSubmitting(false);
    } else {
      if (!selectedAreaId) {
        toast.error('Please select an area or add a new one');
        return;
      }
      setIsSubmitting(true);
      await updateClinicLocation.mutateAsync({ cityId: selectedCityId, areaId: selectedAreaId });
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <MapPin className="h-7 w-7 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-xl">Confirm Your Location</DialogTitle>
          <DialogDescription className="text-center">
            We couldn't confidently match your practice area. Please select where your clinic is
            located so we can list you correctly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* City Selection */}
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Select
              value={selectedCityId || ''}
              onValueChange={(value) => {
                setSelectedCityId(value);
                setSelectedAreaId(null);
                setShowNewArea(false);
              }}
              disabled={citiesLoading}
            >
              <SelectTrigger id="city">
                <SelectValue placeholder={citiesLoading ? 'Loading...' : 'Select your city'} />
              </SelectTrigger>
              <SelectContent>
                {cities?.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {detectedCity && selectedCityId && (
              <p className="text-xs text-muted-foreground">
                Detected from address: {detectedCity}
              </p>
            )}
          </div>

          {/* Area Selection */}
          {selectedCityId && !showNewArea && (
            <div className="space-y-2">
              <Label htmlFor="area">Area / Neighborhood</Label>
              <Select
                value={selectedAreaId || ''}
                onValueChange={setSelectedAreaId}
                disabled={areasLoading}
              >
                <SelectTrigger id="area">
                  <SelectValue
                    placeholder={areasLoading ? 'Loading...' : 'Select your area'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {areas?.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewArea(true)}
                className="w-full text-primary"
              >
                <Plus className="h-4 w-4 mr-1" />
                My area is not listed
              </Button>
            </div>
          )}

          {/* New Area Input */}
          {selectedCityId && showNewArea && (
            <div className="space-y-2">
              <Label htmlFor="newArea">New Area Name</Label>
              <Input
                id="newArea"
                placeholder="Enter your area name"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
              />
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  New areas require admin approval. Your clinic will remain unlisted until approved
                  (usually within 24 hours).
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewArea(false);
                  setNewAreaName('');
                }}
                className="text-muted-foreground"
              >
                ← Back to area list
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmLocation}
            disabled={isSubmitting || !selectedCityId || (!selectedAreaId && !showNewArea)}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {showNewArea ? 'Submitting...' : 'Confirming...'}
              </>
            ) : showNewArea ? (
              'Submit for Review'
            ) : (
              'Confirm Location'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}