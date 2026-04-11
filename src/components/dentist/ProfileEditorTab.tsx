import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Building2,
  Save,
  Globe,
  Phone,
  Mail,
  MapPin,
  Clock,
  Image as ImageIcon,
  Plus,
  X,
  CheckCircle,
  Loader2,
  Upload,
  Trash2,
  Link as LinkIcon,
  AlertCircle,
  ExternalLink,
  Camera,
} from 'lucide-react';
import { createAuditLog } from '@/lib/audit';

interface ClinicData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  cover_image_url: string | null;
  verification_status: string | null;
  google_place_id: string | null;
  city: { id: string; name: string } | null;
  area: { id: string; name: string } | null;
}

interface ClinicHours {
  id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
}

interface ClinicImage {
  id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Generate 30-minute time slot options
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
});

export default function ProfileEditorTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<ClinicData>>({});
  const [hours, setHours] = useState<ClinicHours[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [addImageOpen, setAddImageOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  
  // Location/Service Area State
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [currentServiceAreas, setCurrentServiceAreas] = useState<any[]>([]);

  // Fetch cities for location selector
  const { data: cities = [] } = useQuery({
    queryKey: ['all-cities-for-selector', locationSearch],
    queryFn: async () => {
      let query = supabase.from('cities').select('id, name, slug, state_id').order('name').limit(50);
      if (locationSearch) {
        query = query.ilike('name', `%${locationSearch}%`);
      }
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  // Fetch areas for service area selector
  const { data: areas = [] } = useQuery({
    queryKey: ['all-areas-for-selector', selectedCity, locationSearch],
    queryFn: async () => {
      if (!selectedCity) return [];
      let query = supabase.from('areas').select('id, name, city_id').eq('city_id', selectedCity).order('name').limit(30);
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedCity,
  });

  // GMB integration state
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingGmb, setIsSyncingGmb] = useState(false);
  const [manualPlaceId, setManualPlaceId] = useState('');
  const [isSavingPlaceId, setIsSavingPlaceId] = useState(false);
  const [gmbJustConnected, setGmbJustConnected] = useState(false);

  // Detect GMB connection success from URL params
  useEffect(() => {
    const gmbConnected = searchParams.get('gmb_connected');
    if (gmbConnected === 'true') {
      setGmbJustConnected(true);
      toast.success('Google Business Profile connected successfully!');
      // Remove the param to prevent showing toast again on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('gmb_connected');
      newParams.set('tab', 'my-profile');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch clinic data
  const { data: clinic, isLoading } = useQuery({
    queryKey: ['dentist-clinic-profile', user?.id],
    queryFn: async () => {
      // First try to find clinic by claimed_by
      let query = supabase
        .from('clinics')
        .select(`
          id, name, slug, description, address, phone, email, website,
          cover_image_url, verification_status, google_place_id,
          city:cities(id, name),
          area:areas(id, name)
        `)
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();

      let { data, error } = await query;

      // If not found, check clinic_members table
      if ((!data || error) && user?.id) {
        const { data: memberData } = await supabase
          .from('clinic_members')
          .select('clinic_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1)
          .single();

        if (memberData?.clinic_id) {
          query = supabase
            .from('clinics')
            .select(`
              id, name, slug, description, address, phone, email, website,
              cover_image_url, verification_status, google_place_id,
              city:cities(id, name),
              area:areas(id, name)
            `)
            .eq('id', memberData.clinic_id)
            .limit(1)
            .single();
          const result = await query;
          data = result.data;
          error = result.error;
        }
      }

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setFormData({
          name: data.name,
          description: data.description,
          address: data.address,
          phone: data.phone,
          email: data.email,
          website: data.website,
          cover_image_url: data.cover_image_url,
          google_place_id: data.google_place_id,
        });
        
        // Fetch service areas after clinic is loaded
        if (data.id) {
          const { data: serviceAreasData } = await supabase
            .from('clinic_service_areas')
            .select('area_id, areas(id, name)')
            .eq('clinic_id', data.id)
            .eq('is_active', true);
          if (serviceAreasData) {
            setCurrentServiceAreas(serviceAreasData);
          }
        }
      }
      return data as unknown as ClinicData | null;
    },
    enabled: !!user?.id,
  });

  // Fetch clinic hours
  const { data: clinicHours } = useQuery({
    queryKey: ['clinic-hours', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_hours')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('day_of_week');

      if (error) throw error;
      
      // Initialize hours for all days if not present
      const existingHours = data || [];
      const allHours: ClinicHours[] = DAYS.map((_, index) => {
        const existing = existingHours.find(h => h.day_of_week === index);
        return existing || {
          id: `new-${index}`,
          day_of_week: index,
          open_time: '09:00',
          close_time: '18:00',
          is_closed: index === 0 || index === 6, // Sunday and Saturday closed by default
        };
      });
      setHours(allHours);
      return allHours;
    },
    enabled: !!clinic?.id,
  });

  // Fetch clinic images
  const { data: images } = useQuery({
    queryKey: ['clinic-images', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_images')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('display_order');

      if (error) throw error;
      return (data || []) as ClinicImage[];
    },
    enabled: !!clinic?.id,
  });

  // Save profile mutation
  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) throw new Error('No clinic found');

      const updates = {
        name: formData.name,
        description: formData.description,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
        cover_image_url: formData.cover_image_url,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('clinics')
        .update(updates)
        .eq('id', clinic.id);

      if (error) throw error;

      await createAuditLog({
        action: 'UPDATE',
        entityType: 'clinic',
        entityId: clinic.id,
        newValues: updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dentist-clinic-profile'] });
      toast.success('Profile updated successfully');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update profile'),
  });

  // Save hours mutation
  const saveHours = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) throw new Error('No clinic found');

      for (const hour of hours) {
        if (hour.id.startsWith('new-')) {
          // Insert new
          const { error } = await supabase
            .from('clinic_hours')
            .insert({
              clinic_id: clinic.id,
              day_of_week: hour.day_of_week,
              open_time: hour.open_time,
              close_time: hour.close_time,
              is_closed: hour.is_closed,
            });
          if (error) throw error;
        } else {
          // Update existing
          const { error } = await supabase
            .from('clinic_hours')
            .update({
              open_time: hour.open_time,
              close_time: hour.close_time,
              is_closed: hour.is_closed,
            })
            .eq('id', hour.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-hours'] });
      toast.success('Hours updated successfully');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update hours'),
  });

  // Add gallery image mutation
  const addImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      if (!clinic?.id) throw new Error('No clinic found');
      
      const { error } = await supabase
        .from('clinic_images')
        .insert({
          clinic_id: clinic.id,
          image_url: imageUrl,
          display_order: (images?.length || 0) + 1,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-images'] });
      setNewImageUrl('');
      setAddImageOpen(false);
      toast.success('Image added successfully');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add image'),
  });

  // Delete gallery image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await supabase
        .from('clinic_images')
        .delete()
        .eq('id', imageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-images'] });
      toast.success('Image deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete image'),
  });

  const handleAddGalleryImage = () => {
    if (!newImageUrl.trim()) return;
    addImageMutation.mutate(newImageUrl.trim());
  };

  // Handle profile photo file upload
  const handleProfilePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !clinic?.id) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clinic.id}/profile-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('clinic-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clinic-assets')
        .getPublicUrl(fileName);

      setFormData({ ...formData, cover_image_url: publicUrl });
      toast.success('Photo uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle gallery image file upload
  const handleGalleryFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !clinic?.id) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clinic.id}/gallery-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('clinic-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clinic-assets')
        .getPublicUrl(fileName);

      addImageMutation.mutate(publicUrl);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfile.mutateAsync();
      await saveHours.mutateAsync();
    } finally {
      setIsSaving(false);
    }
  };

  // GMB OAuth sign-in handler
  // Creates a secure server-side token before initiating OAuth to ensure proper role/clinic transfer
  const handleGoogleSignIn = async () => {
    setIsConnectingGoogle(true);
    try {
      if (!clinic?.id) {
        throw new Error('No clinic found to connect.');
      }

      // Get current session to store before OAuth
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentSession || !currentUser) {
        throw new Error('Please sign in first');
      }

      const hasGoogleIdentity = currentUser?.identities?.some(
        (identity) => identity.provider === 'google'
      );

      if (hasGoogleIdentity) {
        toast.info('Google account already connected. You can sync now.');
        setIsConnectingGoogle(false);
        return;
      }

      // CRITICAL: Store the original user's session before OAuth
      // This allows us to restore their session after getting the GMB token
      // even if they use a different Google account for GMB
      const { storeOriginalSession } = await import('@/lib/gmbAuth');
      storeOriginalSession(
        currentSession.access_token,
        currentSession.refresh_token || '',
        currentUser.id
      );

      // Create a secure server-side link request token
      const { data: linkRequest, error: linkError } = await supabase
        .from('gmb_link_requests')
        .insert({
          clinic_id: clinic.id,
          initiated_by: currentUser.id,
        })
        .select('token')
        .single();

      if (linkError || !linkRequest?.token) {
        console.error('Failed to create GMB link request:', linkError);
        throw new Error('Failed to prepare GMB connection. Please try again.');
      }

      // Store the token AND a flag in localStorage - URL params may not be preserved through OAuth
      localStorage.setItem('gmb_link_token', linkRequest.token);
      localStorage.setItem('gmb_pending', 'true');
      // Mark that we need to restore the original user after GMB OAuth
      localStorage.setItem('gmb_restore_session', 'true');

      // Always use production domain for OAuth callback
      const redirectTo = 'https://www.appointpanda.com/auth/callback?gmb=true';

      // Use signInWithOAuth to get the GMB token
      // The callback handler will capture the token and restore the original user session
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'openid email profile https://www.googleapis.com/auth/business.manage',
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent select_account',
          },
        },
      });

      if (error) {
        // Clean up on error
        localStorage.removeItem('gmb_link_token');
        localStorage.removeItem('gmb_pending');
        localStorage.removeItem('gmb_restore_session');
        throw error;
      }
      // Success path will redirect the browser.
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect with Google');
      setIsConnectingGoogle(false);
    }
  };

  // GMB sync handler
  const handleGmbSync = async () => {
    if (!clinic?.id || !clinic?.google_place_id) return;
    setIsSyncingGmb(true);
    try {
      // Call GMB import edge function for this clinic
      const { error } = await supabase.functions.invoke('gmb-import', {
        body: { 
          placeId: clinic.google_place_id,
          clinicId: clinic.id,
          syncOnly: true 
        },
      });
      if (error) throw error;
      toast.success('Profile synced with Google Business');
      queryClient.invalidateQueries({ queryKey: ['dentist-clinic-profile'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync with Google');
    } finally {
      setIsSyncingGmb(false);
    }
  };

  // Manual Place ID save handler
  const handleManualPlaceIdSave = async () => {
    if (!clinic?.id || !manualPlaceId.trim()) return;
    setIsSavingPlaceId(true);
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ 
          google_place_id: manualPlaceId.trim(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', clinic.id);
      
      if (error) throw error;
      
      await createAuditLog({
        action: 'UPDATE',
        entityType: 'clinic',
        entityId: clinic.id,
        newValues: { google_place_id: manualPlaceId.trim() },
      });
      
      toast.success('Google Place ID saved successfully');
      setManualPlaceId('');
      queryClient.invalidateQueries({ queryKey: ['dentist-clinic-profile'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save Place ID');
    } finally {
      setIsSavingPlaceId(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No Practice Linked</h2>
        <p className="text-muted-foreground mb-6">
          Please claim your practice profile first to edit it.
        </p>
        <Button asChild>
          <Link to="/claim-profile">Claim Your Profile</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Edit Profile</h2>
          <p className="text-muted-foreground">Customize your clinic information</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Cover Image / Profile Photo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Profile Photo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <div className="relative">
              {formData.cover_image_url ? (
                <img 
                  src={formData.cover_image_url} 
                  alt="Clinic" 
                  className="h-32 w-32 rounded-2xl object-cover border-2 border-border shadow-md"
                />
              ) : (
                <div className="h-32 w-32 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                  <Building2 className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              {formData.cover_image_url && (
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
                  onClick={() => setFormData({ ...formData, cover_image_url: null })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex-1 space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label>Upload from Device</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full gap-2"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isUploading ? 'Uploading...' : 'Choose Image'}
                </Button>
              </div>
              
              {/* Or use URL */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or paste URL</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={formData.cover_image_url || ''}
                    onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                    placeholder="https://example.com/your-image.jpg"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommended size: 400x400px. Supports JPG, PNG, WebP.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Clinic Name</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your clinic name"
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell patients about your clinic, services, and expertise..."
              rows={4}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+971 4 XXX XXXX"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@yourclinic.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                className="pl-10"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full clinic address"
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location & Service Areas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Service Areas
          </CardTitle>
          <CardDescription>
            Manage your clinic location and areas you serve
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Location */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Primary Location</Label>
                <p className="text-sm text-muted-foreground">Your main clinic location</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsChangingLocation(!isChangingLocation)}
              >
                {isChangingLocation ? 'Cancel' : 'Change Location'}
              </Button>
            </div>
            
            {/* Current Location Display */}
            {!isChangingLocation && (
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{clinic?.city?.name || 'Not set'}</p>
                  {clinic?.area?.name && (
                    <p className="text-sm text-muted-foreground">{clinic.area.name}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Location Change Form */}
            {isChangingLocation && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Search City</Label>
                  <Input
                    placeholder="Search for your city..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                  />
                </div>
                
                {cities.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select City</Label>
                    <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {cities.map((city: any) => (
                        <button
                          key={city.id}
                          onClick={() => {
                            setSelectedCity(city.id);
                            setLocationSearch('');
                          }}
                          className="w-full text-left p-2 hover:bg-accent rounded flex items-center justify-between"
                        >
                          <span>{city.name}</span>
                          {clinic?.city?.id === city.id && (
                            <Badge variant="default">Current</Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    onClick={async () => {
                      if (!selectedCity || !clinic?.id) return;
                      const { error } = await supabase
                        .from('clinics')
                        .update({ 
                          city_id: selectedCity,
                          previous_city_id: clinic.city?.id,
                          location_changed_at: new Date().toISOString()
                        })
                        .eq('id', clinic.id);
                      
                      if (!error) {
                        toast.success('Location updated! Profile will reflect changes after refresh.');
                        queryClient.invalidateQueries({ queryKey: ['dentist-clinic-profile'] });
                        setIsChangingLocation(false);
                        setSelectedCity('');
                      } else {
                        toast.error('Failed to update location');
                      }
                    }}
                    disabled={!selectedCity}
                  >
                    Save New Location
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <Separator />
          
          {/* Service Areas */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Service Areas</Label>
              <p className="text-sm text-muted-foreground">
                Add nearby areas you serve (patients from these areas can find you)
              </p>
            </div>
            
            {/* Current Service Areas */}
            {currentServiceAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentServiceAreas.map((sa: any) => (
                  <Badge key={sa.area_id} variant="secondary" className="gap-1">
                    {sa.areas?.name || 'Unknown Area'}
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Add Service Area */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Add Service Area</Label>
                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area..." />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area: any) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline"
                  onClick={async () => {
                    if (!selectedArea || !clinic?.id) return;
                    const { error } = await supabase
                      .from('clinic_service_areas')
                      .insert({
                        clinic_id: clinic.id,
                        area_id: selectedArea,
                        is_primary: currentServiceAreas.length === 0
                      });
                    
                    if (!error) {
                      toast.success('Service area added!');
                      queryClient.invalidateQueries({ queryKey: ['clinic-service-areas'] });
                      setSelectedArea('');
                    } else {
                      toast.error('Failed to add service area');
                    }
                  }}
                  disabled={!selectedArea}
                >
                  Add Area
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Business Integration */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google Business Profile Sync
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clinic.google_place_id ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-teal mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-teal">Google Business Connected</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your Google reviews and business data are synced.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline">{clinic.google_place_id}</Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <a 
                        href={`https://www.google.com/maps/place/?q=place_id:${clinic.google_place_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Google <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleGmbSync()}
                disabled={isSyncingGmb}
              >
                {isSyncingGmb ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Sync Now from Google
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Google Business Not Connected</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect your Google Business profile to sync reviews, photos, and enable the review redirect feature.
                  </p>
                </div>
              </div>
              
              {/* Sign in with Google Button */}
              <div className="p-4 bg-background rounded-xl border space-y-4">
                <div className="text-center">
                  <p className="text-sm font-medium mb-3">Connect with your Google account</p>
                  <Button 
                    variant="outline" 
                    className="w-full gap-3 h-12 text-base"
                    onClick={() => handleGoogleSignIn()}
                    disabled={isConnectingGoogle}
                  >
                    {isConnectingGoogle ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                    Sign in with Google
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    This will verify your ownership and sync your business profile
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Google Place ID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={manualPlaceId}
                      onChange={(e) => setManualPlaceId(e.target.value)}
                      placeholder="ChIJ..."
                    />
                    <Button 
                      onClick={() => handleManualPlaceIdSave()}
                      disabled={!manualPlaceId.trim() || isSavingPlaceId}
                    >
                      {isSavingPlaceId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Find your Place ID at{' '}
                    <a 
                      href="https://developers.google.com/maps/documentation/places/web-service/place-id" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google Place ID Finder
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opening Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Opening Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {hours.map((hour, index) => (
              <div key={hour.day_of_week} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
                <div className="w-28 font-medium">{DAYS[hour.day_of_week]}</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!hour.is_closed}
                    onChange={(e) => {
                      const newHours = [...hours];
                      newHours[index] = { ...hour, is_closed: !e.target.checked };
                      setHours(newHours);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-muted-foreground">Open</span>
                </label>
                {!hour.is_closed && (
                  <>
                    <Select
                      value={hour.open_time || '09:00'}
                      onValueChange={(value) => {
                        const newHours = [...hours];
                        newHours[index] = { ...hour, open_time: value };
                        setHours(newHours);
                      }}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">to</span>
                    <Select
                      value={hour.close_time || '18:00'}
                      onValueChange={(value) => {
                        const newHours = [...hours];
                        newHours[index] = { ...hour, close_time: value };
                        setHours(newHours);
                      }}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {hour.is_closed && (
                  <Badge variant="secondary">Closed</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gallery Images */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Gallery Images
          </CardTitle>
          <div className="flex gap-2">
            {/* File Upload Button */}
            <input
              ref={galleryFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleGalleryFileUpload}
              className="hidden"
            />
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2"
              onClick={() => galleryFileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload
            </Button>
            <Dialog open={addImageOpen} onOpenChange={setAddImageOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Add URL
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Gallery Image by URL</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  {newImageUrl && (
                    <div className="rounded-lg overflow-hidden border">
                      <img 
                        src={newImageUrl} 
                        alt="Preview" 
                        className="w-full h-48 object-cover"
                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/400x200?text=Invalid+URL')}
                      />
                    </div>
                  )}
                  <Button 
                    className="w-full" 
                    onClick={handleAddGalleryImage}
                    disabled={!newImageUrl.trim() || addImageMutation.isPending}
                  >
                    {addImageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add Image
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {images && images.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((img) => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border">
                  <img 
                    src={img.image_url} 
                    alt={img.caption || 'Gallery'} 
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                      size="icon" 
                      variant="destructive" 
                      className="h-8 w-8"
                      onClick={() => deleteImageMutation.mutate(img.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No gallery images yet</p>
              <p className="text-sm">Add images to showcase your clinic</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
