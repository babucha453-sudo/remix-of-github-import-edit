import { getDay } from "date-fns";

export interface ClinicHours {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface TimeSlot {
  value: string;
  label: string;
}

export const formatTimeRange = (hour: number): string => {
  const startHour = hour;
  const endHour = hour + 1;

  const formatHour = (h: number) => {
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return `12:00 PM`;
    return `${h - 12}:00 PM`;
  };

  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
};

export const generateTimeSlots = (
  openTime: string | null,
  closeTime: string | null
): TimeSlot[] => {
  if (!openTime || !closeTime) {
    return Array.from({ length: 9 }, (_, i) => {
      const hour = i + 9;
      const time = `${hour.toString().padStart(2, "0")}:00`;
      return { value: time, label: formatTimeRange(hour) };
    });
  }

  const slots: TimeSlot[] = [];
  const [openHour] = openTime.split(":").map(Number);
  const [closeHour] = closeTime.split(":").map(Number);

  for (let hour = openHour; hour < closeHour; hour++) {
    const time = `${hour.toString().padStart(2, "0")}:00`;
    slots.push({ value: time, label: formatTimeRange(hour) });
  }

  return slots;
};

export const defaultTimeSlots: TimeSlot[] = Array.from({ length: 9 }, (_, i) => {
  const hour = i + 9;
  const time = `${hour.toString().padStart(2, "0")}:00`;
  return { value: time, label: formatTimeRange(hour) };
});

export const getTimeSlotsForDate = (
  date: Date,
  clinicHours: ClinicHours[] | null | undefined
): TimeSlot[] => {
  const dayOfWeek = getDay(date);

  if (!clinicHours || clinicHours.length === 0) {
    return defaultTimeSlots;
  }

  const dayHours = clinicHours.find((h) => h.day_of_week === dayOfWeek);

  if (!dayHours || dayHours.is_closed) {
    return [];
  }

  return generateTimeSlots(dayHours.open_time, dayHours.close_time);
};

export const getClosedDays = (
  clinicHours: ClinicHours[] | null | undefined
): number[] => {
  if (!clinicHours || clinicHours.length === 0) {
    return [0];
  }
  return clinicHours
    .filter((h) => h.is_closed)
    .map((h) => h.day_of_week);
};