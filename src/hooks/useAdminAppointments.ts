import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface AdminAppointment {
  id: string;
  clinic_id: string | null;
  dentist_id: string | null;
  treatment_id: string | null;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string;
  preferred_date: string | null;
  preferred_time: string | null;
  confirmed_date: string | null;
  confirmed_time: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  admin_notes: string | null;
  is_disputed: boolean;
  source: string;
  manage_token: string | null;
  created_at: string;
  clinic?: { id: string; name: string; slug?: string };
  dentist?: { id: string; name: string };
  treatment?: { id: string; name: string };
}

interface AppointmentsFilters {
  status?: string;
  clinicId?: string;
  dentistId?: string;
  treatmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  isDisputed?: boolean;
  source?: string;
}

export function useAdminAppointments(filters: AppointmentsFilters = {}) {
  return useQuery({
    queryKey: ['admin-appointments', filters],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('*, manage_token, clinic:clinics!appointments_clinic_id_fkey(id, name, slug), dentist:dentists(id, name), treatment:treatments(id, name)')
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show');
      if (filters.clinicId) query = query.eq('clinic_id', filters.clinicId);
      if (filters.dentistId) query = query.eq('dentist_id', filters.dentistId);
      if (filters.treatmentId) query = query.eq('treatment_id', filters.treatmentId);
      if (filters.dateFrom) query = query.gte('preferred_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('preferred_date', filters.dateTo);
      if (filters.isDisputed !== undefined) query = query.eq('is_disputed', filters.isDisputed);
      if (filters.source) query = query.eq('source', filters.source);

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as AdminAppointment[];
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates, sendNotification = true }: { id: string; updates: Partial<AdminAppointment>; sendNotification?: boolean }) => {
      const { data: old } = await supabase.from('appointments').select('*').eq('id', id).single();
      const { error } = await supabase.from('appointments').update(updates).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'appointment', entityId: id, oldValues: old, newValues: updates });
      
      // Send email notification if status changed (fire-and-forget with graceful handling)
      if (sendNotification && updates.status && old?.status !== updates.status) {
        // Use fire-and-forget pattern to avoid blocking the UI
        supabase.functions.invoke('send-booking-email', {
          body: {
            appointmentId: id,
            type: 'status_update',
            newStatus: updates.status,
          },
        }).then(response => {
          if (response.error) {
            console.warn('Email notification may have failed:', response.error);
          } else if (response.data?.success) {
            toast.success(`Email sent to ${response.data.to}`);
          } else if (response.data?.error) {
            console.warn('Email not sent:', response.data.error);
          }
        }).catch(err => {
          // Network errors don't mean the email failed - the edge function may still process it
          console.warn('Email notification request error (may still be processing):', err);
        });
      }
      
      // Send SMS notification if status changed
      if (sendNotification && updates.status && old?.status !== updates.status) {
        try {
          const response = await supabase.functions.invoke('send-appointment-notification', {
            body: {
              appointmentId: id,
              newStatus: updates.status,
              oldStatus: old?.status,
              confirmedDate: updates.confirmed_date,
              confirmedTime: updates.confirmed_time,
            },
          });
          
          if (response.error) {
            console.error('Failed to send SMS notification:', response.error);
          }
        } catch (notifError) {
          console.error('SMS notification error:', notifError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
      toast.success('Appointment updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

// Per-dentist booking counts
export function useDentistBookingCounts() {
  return useQuery({
    queryKey: ['dentist-booking-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('dentist_id, dentist:dentists(id, name)')
        .not('dentist_id', 'is', null);
      
      if (error) throw error;
      
      const counts: Record<string, { name: string; count: number }> = {};
      data.forEach((apt: any) => {
        const id = apt.dentist_id;
        const name = apt.dentist?.name || 'Unknown';
        if (!counts[id]) counts[id] = { name, count: 0 };
        counts[id].count++;
      });
      
      return Object.entries(counts)
        .map(([id, { name, count }]) => ({ id, name, count }))
        .sort((a, b) => b.count - a.count);
    },
  });
}

// Booking notifications
export function useBookingNotifications() {
  return useQuery({
    queryKey: ['booking-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('booking_notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-notifications'] });
    },
  });
}
