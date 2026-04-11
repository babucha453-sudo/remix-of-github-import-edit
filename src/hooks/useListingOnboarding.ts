import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface OnboardingStep {
  id: number;
  name: string;
  description: string;
  required: boolean;
  fields: string[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    name: 'Basic Identity',
    description: 'Clinic name and contact person',
    required: true,
    fields: ['clinicName', 'dentistName', 'email', 'phone'],
  },
  {
    id: 2,
    name: 'Location',
    description: 'Address and service area',
    required: true,
    fields: ['stateId', 'cityId', 'address'],
  },
  {
    id: 3,
    name: 'Profile Details',
    description: 'About your practice',
    required: true,
    fields: ['description', 'yearsExperience', 'teamSize', 'languages'],
  },
  {
    id: 4,
    name: 'Services',
    description: 'What you offer',
    required: true,
    fields: ['services'],
  },
  {
    id: 5,
    name: 'Insurance & Payment',
    description: 'Accepted plans',
    required: false,
    fields: ['insurance', 'paymentMethods'],
  },
  {
    id: 6,
    name: 'Photos & Media',
    description: 'Clinic images',
    required: false,
    fields: ['logo', 'coverImage', 'gallery'],
  },
  {
    id: 7,
    name: 'Verification',
    description: 'License and credentials',
    required: true,
    fields: ['license', 'documents'],
  },
  {
    id: 8,
    name: 'Review',
    description: 'Preview and submit',
    required: true,
    fields: ['termsAccepted'],
  },
];

export interface DraftData {
  clinicName?: string;
  dentistName?: string;
  email?: string;
  phone?: string;
  website?: string;
  stateId?: string;
  cityId?: string;
  address?: string;
  description?: string;
  yearsExperience?: string;
  teamSize?: string;
  languages?: string[];
  services?: string[];
  insurance?: string[];
  paymentMethods?: string[];
  logo?: string;
  coverImage?: string;
  gallery?: string[];
  licenseNumber?: string;
  licenseState?: string;
  termsAccepted?: boolean;
}

export function useListingOnboarding() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [draftData, setDraftData] = useState<DraftData>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing draft
  const { data: existingDraft, isLoading: isLoadingDraft } = useQuery({
    queryKey: ['listing-draft', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('listing_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRD116') {
        console.error('Error fetching draft:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  // Load draft data when available
  useEffect(() => {
    if (existingDraft) {
      setCurrentStep(existingDraft.current_step || 1);
      
      // Merge all step data
      const mergedData: DraftData = {
        ...(existingDraft.step_1_data || {}),
        ...(existingDraft.step_2_data || {}),
        ...(existingDraft.step_3_data || {}),
        ...(existingDraft.step_4_data || {}),
        ...(existingDraft.step_5_data || {}),
        ...(existingDraft.step_6_data || {}),
        ...(existingDraft.step_7_data || {}),
        ...(existingDraft.step_8_data || {}),
      };
      setDraftData(mergedData);
    }
  }, [existingDraft]);

  // Save draft mutation
  const saveDraft = useMutation({
    mutationFn: async (stepData: Partial<DraftData>, step?: number) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const stepNum = step || currentStep;
      const stepField = `step_${stepNum}_data`;
      
      const updates: Record<string, any> = {
        user_id: user.id,
        current_step: stepNum,
        updated_at: new Date().toISOString(),
        [stepField]: stepData,
      };
      
      // Calculate completion score
      const score = calculateCompletionScore({ ...draftData, ...stepData });
      updates.completion_score = score;
      
      if (existingDraft?.id) {
        const { error } = await supabase
          .from('listing_drafts')
          .update(updates)
          .eq('id', existingDraft.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('listing_drafts')
          .insert(updates);
        
        if (error) throw error;
      }
      
      return true;
    },
    onSuccess: () => {
      const queryClient = useQueryClient();
      queryClient.invalidateQueries({ queryKey: ['listing-draft', user?.id] });
    },
  });

  // Auto-save hook
  const autoSave = useCallback(async (data: Partial<DraftData>) => {
    setIsSaving(true);
    try {
      await saveDraft.mutateAsync(data);
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [saveDraft, draftData]);

  // Calculate completion score
  const calculateCompletionScore = (data: DraftData): number => {
    let score = 0;
    const totalWeights = 100;
    
    // Basic info (20%)
    if (data.clinicName) score += 5;
    if (data.dentistName) score += 5;
    if (data.email) score += 5;
    if (data.phone) score += 5;
    
    // Location (15%)
    if (data.cityId) score += 10;
    if (data.address) score += 5;
    
    // Profile (15%)
    if (data.description && data.description.length > 50) score += 10;
    if (data.languages && data.languages.length > 0) score += 5;
    
    // Services (15%)
    if (data.services && data.services.length > 0) score += 15;
    
    // Insurance (10%)
    if (data.insurance && data.insurance.length > 0) score += 5;
    if (data.paymentMethods && data.paymentMethods.length > 0) score += 5;
    
    // Media (10%)
    if (data.logo) score += 5;
    if (data.coverImage) score += 5;
    
    // Verification (10%)
    if (data.licenseNumber) score += 10;
    
    // Terms (5%)
    if (data.termsAccepted) score += 5;
    
    return Math.min(score, 100);
  };

  // Submit listing for approval
  const submitListing = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Must be logged in');
      if (!draftData.termsAccepted) throw new Error('Must accept terms');
      
      // Create clinic record
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .insert({
          name: draftData.clinicName,
          slug: draftData.clinicName?.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          description: draftData.description,
          address: draftData.address,
          phone: draftData.phone,
          email: draftData.email,
          website: draftData.website,
          city_id: draftData.cityId,
          cover_image_url: draftData.coverImage,
          logo_url: draftData.logo,
          listing_status: 'submitted',
          claim_status: 'pending',
          verification_status: 'pending',
        })
        .select()
        .single();
      
      if (clinicError) throw clinicError;
      
      // Add user as owner
      const { error: memberError } = await supabase
        .from('clinic_members')
        .insert({
          clinic_id: clinic.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
          accepted_at: new Date().toISOString(),
        });
      
      if (memberError) throw memberError;
      
      // Add services
      if (draftData.services && draftData.services.length > 0) {
        await supabase.from('clinic_services').insert(
          (draftData.services as string[]).map(serviceId => ({
            clinic_id: clinic.id,
            treatment_id: serviceId,
            is_active: true,
          }))
        );
      }
      
      // Mark draft as converted
      if (existingDraft?.id) {
        await supabase
          .from('listing_drafts')
          .update({
            status: 'converted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingDraft.id);
      }
      
      // Log activity
      await supabase.from('listing_activity_logs').insert({
        clinic_id: clinic.id,
        user_id: user.id,
        action: 'listing_submitted',
        action_details: { source: 'onboarding' },
      });
      
      // Log approval action
      await supabase.from('listing_approval_logs').insert({
        clinic_id: clinic.id,
        user_id: user.id,
        action: 'submitted',
        new_status: 'submitted',
      });
      
      return clinic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-draft', user?.id] });
      toast({
        title: 'Listing Submitted!',
        description: 'Our team will review your listing within 24-48 hours.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Submission Failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Navigation
  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= ONBOARDING_STEPS.length) {
      setCurrentStep(step);
      autoSave({});
    }
  }, [autoSave]);

  const nextStep = useCallback(() => {
    goToStep(Math.min(currentStep + 1, ONBOARDING_STEPS.length));
  }, [currentStep, goToStep]);

  const prevStep = useCallback(() => {
    goToStep(Math.max(currentStep - 1, 1));
  }, [currentStep, goToStep]);

  // Get current step info
  const currentStepInfo = ONBOARDING_STEPS.find(s => s.id === currentStep);
  
  // Calculate overall completion
  const completionScore = calculateCompletionScore(draftData);

  return {
    // Data
    currentStep,
    currentStepInfo,
    draftData,
    completionScore,
    saveDraft,
    autoSave,
    submitListing,
    isSaving,
    isLoadingDraft,
    existingDraft,
    // Navigation
    goToStep,
    nextStep,
    prevStep,
    // Steps
    steps: ONBOARDING_STEPS,
    // Helpers
    calculateCompletionScore,
  };
}

// ============================================================================
// Claim Listing Hook
// ============================================================================

export function useClaimListing(clinicId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [claimData, setClaimData] = useState({
    claimantName: '',
    claimantEmail: '',
    claimantPhone: '',
    claimantRole: '',
    claimMethod: 'business_email' as const,
  });

  // Submit claim
  const submitClaim = useMutation({
    mutationFn: async () => {
      if (!user?.id || !clinicId) {
        throw new Error('Must be logged in and clinic must be specified');
      }
      
      // Generate verification token
      const token = crypto.randomUUID();
      
      const { error } = await supabase
        .from('listing_claims')
        .insert({
          clinic_id: clinicId,
          user_id: user.id,
          claimant_name: claimData.claimantName,
          claimant_email: claimData.claimantEmail,
          claimant_phone: claimData.claimantPhone,
          claimant_role: claimData.claimantRole,
          claim_method: claimData.claimMethod,
          claim_token: token,
          token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending_verification',
        });
      
      if (error) throw error;
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-claims'] });
      toast({
        title: 'Claim Submitted',
        description: 'Please verify your email to confirm ownership.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Claim Failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  return {
    step,
    setStep,
    claimData,
    setClaimData,
    submitClaim,
  };
}

// ============================================================================
// Admin Hooks
// ============================================================================

export function useAdminListingQueue() {
  const queryClient = useQueryClient();
  
  // Fetch pending listings
  const { data: pendingListings, isLoading } = useQuery({
    queryKey: ['admin-pending-listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*, cities(*, states(*))')
        .eq('listing_status', 'submitted')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Approve listing
  const approveListing = useMutation({
    mutationFn: async ({ clinicId, notes }: { clinicId: string; notes?: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          listing_status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', clinicId);
      
      if (error) throw error;
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-listings'] });
    },
  });

  // Reject listing
  const rejectListing = useMutation({
    mutationFn: async ({ clinicId, reason }: { clinicId: string; reason: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          listing_status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', clinicId);
      
      if (error) throw error;
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-listings'] });
    },
  });

  return {
    pendingListings,
    isLoading,
    approveListing,
    rejectListing,
  };
}

export function useAdminClaimQueue() {
  const queryClient = useQueryClient();
  
  // Fetch pending claims
  const { data: pendingClaims, isLoading } = useQuery({
    queryKey: ['admin-pending-claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listing_claims')
        .select('*, clinics(*), user:users(*)')
        .in('status', ['pending_verification', 'pending_admin_review'])
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Approve claim
  const approveClaim = useMutation({
    mutationFn: async ({ claimId, notes }: { claimId: string; notes?: string }) => {
      // Get claim details
      const { data: claim } = await supabase
        .from('listing_claims')
        .select('clinic_id, user_id')
        .eq('id', claimId)
        .single();
      
      if (!claim) throw new Error('Claim not found');
      
      // Update claim status
      await supabase
        .from('listing_claims')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          admin_notes: notes,
        })
        .eq('id', claimId);
      
      // Add user as owner of clinic (upsert)
      const { error: insertError } = await supabase
        .from('clinic_members')
        .upsert({
          clinic_id: claim.clinic_id,
          user_id: claim.user_id,
          role: 'owner',
          status: 'active',
          accepted_at: new Date().toISOString(),
        }, { onConflict: 'clinic_id, user_id' });
      
      if (insertError) console.error('Member insert error:', insertError);
      
      // Update clinic claim status
      await supabase
        .from('clinics')
        .update({
          claim_status: 'claimed',
        })
        .eq('id', claim.clinic_id);
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-claims'] });
    },
  });

  // Reject claim
  const rejectClaim = useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason: string }) => {
      const { error } = await supabase
        .from('listing_claims')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId);
      
      if (error) throw error;
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-claims'] });
    },
  });

  return {
    pendingClaims,
    isLoading,
    approveClaim,
    rejectClaim,
  };
}