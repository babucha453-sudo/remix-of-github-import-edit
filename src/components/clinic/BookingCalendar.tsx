import { useState } from "react";
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSlot {
  time: string;
  display: string;
  available: boolean;
}

interface BookingCalendarProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  onDateSelect: (date: Date) => void;
  onTimeSelect: (time: string) => void;
  clinicHours?: Array<{
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean | null;
  }>;
}

// Format time range display (1-hour intervals)
const formatTimeRange = (hour: number): string => {
  const startHour = hour;
  const endHour = hour + 1;
  
  const formatHour = (h: number) => {
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return `12:00 PM`;
    if (h > 12 && h < 24) return `${h - 12}:00 PM`;
    return `12:00 AM`;
  };
  
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
};

const generateTimeSlots = (startHour = 8, endHour = 21): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    slots.push({ time, display: formatTimeRange(hour), available: true });
  }
  return slots;
};

export function BookingCalendar({
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
  clinicHours = [],
}: BookingCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = startOfDay(new Date());
  const currentWeekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 0 });

  // Generate 7 days for the current week view
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Check if a day is in the past
  const isPastDay = (date: Date) => isBefore(startOfDay(date), today);

  // Check if clinic is closed on a specific day
  const isClinicClosed = (dayOfWeek: number) => {
    const hours = clinicHours.find(h => h.day_of_week === dayOfWeek);
    return hours?.is_closed === true;
  };

  // Generate time slots based on clinic hours
  const getTimeSlots = (date: Date): TimeSlot[] => {
    const dayOfWeek = date.getDay();
    const hours = clinicHours.find(h => h.day_of_week === dayOfWeek);
    
    if (hours?.is_closed) return [];
    
    const startHour = hours?.open_time 
      ? parseInt(hours.open_time.split(':')[0]) 
      : 9;
    const endHour = hours?.close_time 
      ? parseInt(hours.close_time.split(':')[0]) 
      : 18;
    
    return generateTimeSlots(startHour, endHour);
  };

  const timeSlots = selectedDate ? getTimeSlots(selectedDate) : generateTimeSlots();

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
          disabled={weekOffset === 0}
          className="rounded-xl"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-center">
          <p className="font-bold text-foreground">
            {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-muted-foreground">Select a date</p>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekOffset(weekOffset + 1)}
          disabled={weekOffset >= 8} // Max 8 weeks ahead
          className="rounded-xl"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day Selection */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const isPast = isPastDay(day);
          const isClosed = isClinicClosed(day.getDay());
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          const isDisabled = isPast || isClosed;

          return (
            <button
              key={day.toISOString()}
              onClick={() => !isDisabled && onDateSelect(day)}
              disabled={isDisabled}
              className={cn(
                "flex flex-col items-center p-2 sm:p-3 rounded-2xl transition-all text-center",
                isSelected 
                  ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                  : isDisabled
                    ? "bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50"
                    : "bg-muted/30 hover:bg-muted text-foreground hover:scale-105",
                isCurrentDay && !isSelected && "ring-2 ring-primary/50"
              )}
            >
              <span className="text-[10px] sm:text-xs font-medium uppercase">
                {format(day, 'EEE')}
              </span>
              <span className={cn(
                "text-lg sm:text-xl font-bold mt-0.5",
                isSelected && "text-primary-foreground"
              )}>
                {format(day, 'd')}
              </span>
              {isClosed && (
                <span className="text-[8px] text-destructive">Closed</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div className="space-y-3 animate-fade-in-up">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Available times for {format(selectedDate, 'EEEE, MMMM d')}</span>
          </div>
          
          {timeSlots.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
              {timeSlots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.available && onTimeSelect(slot.time)}
                  disabled={!slot.available}
                  className={cn(
                    "px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    selectedTime === slot.time
                      ? "bg-primary text-primary-foreground shadow-md"
                      : slot.available
                        ? "bg-muted/50 hover:bg-muted text-foreground hover:scale-105"
                        : "bg-muted/20 text-muted-foreground cursor-not-allowed line-through"
                  )}
                >
                  {slot.display}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/30 rounded-2xl">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Clinic is closed on this day</p>
              <p className="text-xs text-muted-foreground mt-1">Please select another date</p>
            </div>
          )}
        </div>
      )}

      {/* No date selected prompt */}
      {!selectedDate && (
        <div className="text-center py-6 bg-muted/30 rounded-2xl">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Select a date above to see available times</p>
        </div>
      )}
    </div>
  );
}
