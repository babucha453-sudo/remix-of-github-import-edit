import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';

interface TimeSlot {
  time: string;
  display: string;
  available: boolean;
  startDatetime: string;
  endDatetime: string;
}

interface AvailabilityRule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number | null;
  buffer_minutes: number | null;
  is_active: boolean | null;
}

interface SlotLock {
  start_datetime: string;
  end_datetime: string;
}

interface Appointment {
  start_datetime: string | null;
  end_datetime: string | null;
  status: string | null;
}

interface AvailabilityBlock {
  start_datetime: string;
  end_datetime: string;
}

export function useSlotGeneration(clinicId: string | null, selectedDate: Date | null) {
  // Fetch availability rules
  const { data: availabilityRules } = useQuery({
    queryKey: ['availability-rules', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dentist_availability_rules')
        .select('*')
        .eq('clinic_id', clinicId!)
        .eq('is_active', true);
      
      if (error) throw error;
      return data as AvailabilityRule[];
    },
    enabled: !!clinicId,
  });

  // Fetch existing appointments for the date
  const { data: existingAppointments } = useQuery({
    queryKey: ['booked-appointments', clinicId, selectedDate?.toISOString()],
    queryFn: async () => {
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('appointments')
        .select('start_datetime, end_datetime, status')
        .eq('clinic_id', clinicId!)
        .gte('start_datetime', `${dateStr}T00:00:00`)
        .lte('start_datetime', `${dateStr}T23:59:59`)
        .in('status', ['pending', 'confirmed']);
      
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!clinicId && !!selectedDate,
  });

  // Fetch active slot locks
  const { data: slotLocks } = useQuery({
    queryKey: ['slot-locks', clinicId, selectedDate?.toISOString()],
    queryFn: async () => {
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('slot_locks')
        .select('start_datetime, end_datetime')
        .eq('clinic_id', clinicId!)
        .gte('start_datetime', `${dateStr}T00:00:00`)
        .lte('start_datetime', `${dateStr}T23:59:59`)
        .gt('expires_at', now)
        .is('converted_to_appointment_id', null);
      
      if (error) throw error;
      return data as SlotLock[];
    },
    enabled: !!clinicId && !!selectedDate,
  });

  // Fetch availability blocks (vacation, blocked times)
  const { data: availabilityBlocks } = useQuery({
    queryKey: ['availability-blocks', clinicId, selectedDate?.toISOString()],
    queryFn: async () => {
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('availability_blocks')
        .select('start_datetime, end_datetime')
        .eq('clinic_id', clinicId!)
        .lte('start_datetime', `${dateStr}T23:59:59`)
        .gte('end_datetime', `${dateStr}T00:00:00`);
      
      if (error) throw error;
      return data as AvailabilityBlock[];
    },
    enabled: !!clinicId && !!selectedDate,
  });

  // Generate available slots
  const generateSlots = (): TimeSlot[] => {
    if (!selectedDate || !availabilityRules) return [];

    const dayOfWeek = selectedDate.getDay();
    const dayRule = availabilityRules.find(r => r.day_of_week === dayOfWeek);
    
    if (!dayRule || !dayRule.is_active) return [];

    const slots: TimeSlot[] = [];
    const slotDuration = dayRule.slot_duration_minutes || 30;
    const buffer = dayRule.buffer_minutes || 0;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Parse start and end times
    const [startHour, startMinute] = dayRule.start_time.split(':').map(Number);
    const [endHour, endMinute] = dayRule.end_time.split(':').map(Number);
    
    let currentTime = new Date(selectedDate);
    currentTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date(selectedDate);
    endTime.setHours(endHour, endMinute, 0, 0);

    // Parse break times if they exist
    let breakStart: Date | null = null;
    let breakEnd: Date | null = null;
    if (dayRule.break_start && dayRule.break_end) {
      const [bsHour, bsMinute] = dayRule.break_start.split(':').map(Number);
      const [beHour, beMinute] = dayRule.break_end.split(':').map(Number);
      breakStart = new Date(selectedDate);
      breakStart.setHours(bsHour, bsMinute, 0, 0);
      breakEnd = new Date(selectedDate);
      breakEnd.setHours(beHour, beMinute, 0, 0);
    }

    const now = new Date();

    while (isBefore(currentTime, endTime)) {
      const slotStart = new Date(currentTime);
      const slotEnd = addMinutes(slotStart, slotDuration);
      
      // Skip if slot is in the past
      if (isBefore(slotStart, now)) {
        currentTime = addMinutes(currentTime, slotDuration + buffer);
        continue;
      }

      // Skip if during break
      if (breakStart && breakEnd) {
        if (
          (isAfter(slotStart, breakStart) || slotStart.getTime() === breakStart.getTime()) &&
          isBefore(slotStart, breakEnd)
        ) {
          currentTime = addMinutes(currentTime, slotDuration + buffer);
          continue;
        }
      }

      // Check if slot overlaps with existing appointment
      const slotStartStr = slotStart.toISOString();
      const slotEndStr = slotEnd.toISOString();
      
      const isBooked = existingAppointments?.some(apt => {
        if (!apt.start_datetime || !apt.end_datetime) return false;
        return (
          (apt.start_datetime < slotEndStr && apt.end_datetime > slotStartStr)
        );
      }) || false;

      // Check if slot is locked
      const isLocked = slotLocks?.some(lock => {
        return (
          (lock.start_datetime < slotEndStr && lock.end_datetime > slotStartStr)
        );
      }) || false;

      // Check if slot is in blocked time
      const isBlocked = availabilityBlocks?.some(block => {
        return (
          (block.start_datetime < slotEndStr && block.end_datetime > slotStartStr)
        );
      }) || false;

      const isAvailable = !isBooked && !isLocked && !isBlocked;

      const hour = slotStart.getHours();
      const minutes = slotStart.getMinutes().toString().padStart(2, '0');
      const displayTime = hour < 12
        ? `${hour}:${minutes} AM`
        : hour === 12
          ? `12:${minutes} PM`
          : `${hour - 12}:${minutes} PM`;

      slots.push({
        time: format(slotStart, 'HH:mm'),
        display: displayTime,
        available: isAvailable,
        startDatetime: slotStartStr,
        endDatetime: slotEndStr,
      });

      currentTime = addMinutes(currentTime, slotDuration + buffer);
    }

    return slots;
  };

  return {
    slots: generateSlots(),
    availabilityRules,
    isLoading: !availabilityRules && !!clinicId,
  };
}

// Hook to create a slot lock
export function useSlotLock() {
  const lockSlot = async (
    clinicId: string,
    startDatetime: string,
    endDatetime: string,
    userId?: string
  ) => {
    const expiresAt = addMinutes(new Date(), 5).toISOString();
    
    const { data, error } = await supabase
      .from('slot_locks')
      .insert({
        clinic_id: clinicId,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        locked_by_user_id: userId || null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const convertLockToAppointment = async (lockId: string, appointmentId: string) => {
    const { error } = await supabase
      .from('slot_locks')
      .update({ converted_to_appointment_id: appointmentId })
      .eq('id', lockId);

    if (error) throw error;
  };

  const releaseLock = async (lockId: string) => {
    const { error } = await supabase
      .from('slot_locks')
      .delete()
      .eq('id', lockId);

    if (error) throw error;
  };

  return { lockSlot, convertLockToAppointment, releaseLock };
}
