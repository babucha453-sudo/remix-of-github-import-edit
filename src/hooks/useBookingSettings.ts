import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createAuditLog } from '@/lib/audit';

interface DentistSettings {
  id: string;
  clinic_id: string;
  booking_enabled: boolean;
  booking_require_approval: boolean | null;
  allow_same_day_booking: boolean | null;
  allow_guest_booking: boolean | null;
  min_advance_booking_hours: number | null;
  max_advance_booking_days: number | null;
  confirmation_email_enabled: boolean | null;
  reminder_sms_enabled: boolean | null;
  reminder_hours_before: number | null;
  cancellation_policy: string | null;
  booking_notes: string | null;
}

export function useBookingSettings(clinicId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['dentist-settings', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dentist_settings')
        .select('*')
        .eq('clinic_id', clinicId!)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as DentistSettings | null;
    },
    enabled: !!clinicId,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<DentistSettings>) => {
      if (!clinicId) throw new Error('No clinic ID');

      // Check if settings exist
      const { data: existing } = await supabase
        .from('dentist_settings')
        .select('id')
        .eq('clinic_id', clinicId)
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from('dentist_settings')
          .update(updates)
          .eq('clinic_id', clinicId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('dentist_settings')
          .insert({ clinic_id: clinicId, ...updates })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dentist-settings', clinicId] });
      
      // Log audit event for booking toggle
      if ('booking_enabled' in variables) {
        createAuditLog({
          action: variables.booking_enabled ? 'enable_booking' : 'disable_booking',
          entityType: 'clinic',
          entityId: clinicId!,
          newValues: { booking_enabled: variables.booking_enabled },
          oldValues: { booking_enabled: !variables.booking_enabled },
        });
      }
    },
  });

  const toggleBooking = async (enabled: boolean) => {
    return updateSettings.mutateAsync({ booking_enabled: enabled });
  };

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
    toggleBooking,
    isUpdating: updateSettings.isPending,
  };
}

// Hook for checking if booking is enabled for a clinic (public)
export function useClinicBookingStatus(clinicId: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['clinic-booking-status', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dentist_settings')
        .select('booking_enabled, allow_guest_booking, min_advance_booking_hours, max_advance_booking_days, booking_notes')
        .eq('clinic_id', clinicId!)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Default to booking enabled if no settings exist
      return data || { booking_enabled: true, allow_guest_booking: true };
    },
    enabled: !!clinicId,
  });

  return {
    bookingEnabled: data?.booking_enabled ?? true,
    allowGuestBooking: data?.allow_guest_booking ?? true,
    minAdvanceHours: (data && 'min_advance_booking_hours' in data) ? data.min_advance_booking_hours ?? 0 : 0,
    maxAdvanceDays: (data && 'max_advance_booking_days' in data) ? data.max_advance_booking_days ?? 60 : 60,
    bookingNotes: (data && 'booking_notes' in data) ? data.booking_notes : undefined,
    isLoading,
  };
}
