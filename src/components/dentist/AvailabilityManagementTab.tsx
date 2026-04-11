import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDentistClinic } from '@/hooks/useDentistClinic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Clock, Plus, Trash2, CalendarOff, CalendarDays, Sparkles, Sun, Moon, Timer, X } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

// Full 24-hour time options in 30-min increments
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? '00' : '30';
  const time = `${hour.toString().padStart(2, '0')}:${minutes}`;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const displayTime = `${displayHour}:${minutes} ${ampm}`;
  return { value: time, label: displayTime };
});

const SLOT_DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

interface AvailabilityRule {
  id?: string;
  clinic_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
}

interface BlockedTime {
  id: string;
  clinic_id: string;
  start_datetime: string;
  end_datetime: string;
  reason: string | null;
  block_type: string | null;
}

// Helper to format time display
function formatTimeDisplay(time: string): string {
  const [hours, mins] = time.split(':').map(Number);
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${displayHour}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

export default function AvailabilityManagementTab() {
  const { data: clinic, isLoading: clinicLoading } = useDentistClinic();
  const queryClient = useQueryClient();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [globalSlotDuration, setGlobalSlotDuration] = useState(30);

  // Fetch availability rules
  const { data: availabilityRules, isLoading: rulesLoading, error: rulesError } = useQuery({
    queryKey: ['availability-rules', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dentist_availability_rules')
        .select('*')
        .eq('clinic_id', clinic!.id)
        .order('day_of_week');
      if (error) throw error;
      return data as AvailabilityRule[];
    },
    enabled: !!clinic?.id,
  });

  // Fetch blocked times
  const { data: blockedTimes, isLoading: blocksLoading, error: blocksError } = useQuery({
    queryKey: ['availability-blocks', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('clinic_id', clinic!.id)
        .gte('end_datetime', new Date().toISOString())
        .order('start_datetime');
      if (error) throw error;
      return data as BlockedTime[];
    },
    enabled: !!clinic?.id,
  });

  // Save rule mutation
  const saveRuleMutation = useMutation({
    mutationFn: async (rule: AvailabilityRule) => {
      if (rule.id) {
        const { error } = await supabase
          .from('dentist_availability_rules')
          .update({
            start_time: rule.start_time,
            end_time: rule.end_time,
            break_start: rule.break_start,
            break_end: rule.break_end,
            slot_duration_minutes: rule.slot_duration_minutes,
            buffer_minutes: rule.buffer_minutes,
            is_active: rule.is_active,
          })
          .eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('dentist_availability_rules').insert(rule);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-rules', clinic?.id] });
      toast.success('Schedule updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update'),
  });

  // Update all slot durations
  const updateAllSlotDurations = async (duration: number) => {
    if (!availabilityRules || availabilityRules.length === 0) return;
    
    for (const rule of availabilityRules) {
      if (rule.id) {
        await supabase
          .from('dentist_availability_rules')
          .update({ slot_duration_minutes: duration })
          .eq('id', rule.id);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['availability-rules', clinic?.id] });
    toast.success('All slot durations updated');
  };

  // Add blocked time
  const addBlockMutation = useMutation({
    mutationFn: async () => {
      if (selectedDates.length === 0) throw new Error('Select at least one date');
      const blocks = selectedDates.map(date => ({
        clinic_id: clinic!.id,
        start_datetime: format(date, "yyyy-MM-dd'T'00:00:00"),
        end_datetime: format(date, "yyyy-MM-dd'T'23:59:59"),
        reason: blockReason || 'Blocked',
        block_type: 'manual',
      }));
      const { error } = await supabase.from('availability_blocks').insert(blocks);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks', clinic?.id] });
      setSelectedDates([]);
      setBlockReason('');
      setShowBlockDialog(false);
      toast.success('Days blocked successfully');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to block days'),
  });

  // Delete blocked time
  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase.from('availability_blocks').delete().eq('id', blockId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks', clinic?.id] });
      toast.success('Block removed');
    },
  });

  // Initialize default rules (Mon-Sat)
  const initializeDefaultRules = async () => {
    if (!clinic?.id) return;
    const defaultRules = DAYS_OF_WEEK.filter(d => d.value !== 0).map(day => ({
      clinic_id: clinic.id,
      day_of_week: day.value,
      start_time: '09:00',
      end_time: '17:00',
      break_start: null,
      break_end: null,
      slot_duration_minutes: globalSlotDuration,
      buffer_minutes: 0,
      is_active: true,
    }));
    const { error } = await supabase.from('dentist_availability_rules').insert(defaultRules);
    if (error) toast.error('Failed to initialize');
    else {
      queryClient.invalidateQueries({ queryKey: ['availability-rules', clinic.id] });
      toast.success('Schedule created');
    }
  };

  if (clinicLoading || rulesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 bg-slate-700/30" />
        <div className="grid gap-3">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-700/30" />)}
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <Card className="#REPLACED# border-slate-700/50">
        <CardContent className="py-12 text-center">
          <p className="text-white/60">No clinic linked to your account</p>
        </CardContent>
      </Card>
    );
  }

  const rulesMap = new Map(availabilityRules?.map(r => [r.day_of_week, r]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-800/90 to-slate-900/90 border border-slate-700/50 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white">Availability</h1>
          <p className="text-white/60 mt-1">Manage your weekly schedule and blocked days</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-coral/50 text-coral hover:bg-coral/10 hover:text-coral">
                <CalendarOff className="h-4 w-4" />
                Block Days
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Block Days</DialogTitle>
                <DialogDescription className="text-gray-600">Select days to mark as unavailable</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={(dates) => setSelectedDates(dates || [])}
                  disabled={(date) => date < new Date() || blockedTimes?.some(b => {
                    const blockDate = new Date(b.start_datetime).toDateString();
                    return new Date(blockDate).toDateString() === date.toDateString();
                  })}
                  className="rounded-xl border border-gray-200 mx-auto bg-white"
                />
                {rulesError && (
                  <p className="text-red-600 text-sm text-center">Failed to load availability rules</p>
                )}
                <div className="space-y-2">
                  <Label className="text-gray-700">Reason (optional)</Label>
                  <Input
                    placeholder="e.g., Vacation, Holiday"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBlockDialog(false)} className="border-gray-300 text-gray-700">
                  Cancel
                </Button>
                <Button
                  onClick={() => addBlockMutation.mutate()}
                  disabled={selectedDates.length === 0 || addBlockMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Block {selectedDates.length} day(s)
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Slot Duration Control */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-lg">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Timer className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Appointment Slot Duration</h3>
                <p className="text-sm text-gray-600">Choose how long each appointment slot should be</p>
              </div>
            </div>
            <div className="flex gap-2">
              {SLOT_DURATIONS.map((d) => (
                <Button
                  key={d.value}
                  variant={globalSlotDuration === d.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setGlobalSlotDuration(d.value);
                    updateAllSlotDurations(d.value);
                  }}
                  className={
                    globalSlotDuration === d.value
                      ? 'bg-primary text-white font-semibold'
                      : 'border-slate-600 text-white hover:bg-slate-700/50'
                  }
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <Card className="#REPLACED# border-slate-700/50 overflow-hidden shadow-lg">
        <div className="h-1 bg-gradient-to-r from-primary via-teal to-primary" />
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <Clock className="h-5 w-5 text-primary" />
            Weekly Schedule
          </CardTitle>
          <CardDescription className="text-white/60">Your regular working hours</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(!availabilityRules || availabilityRules.length === 0) ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="h-8 w-8 text-white/40" />
              </div>
              <p className="text-white/60 mb-4">No schedule configured</p>
              <Button onClick={initializeDefaultRules} className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold">
                <Sparkles className="h-4 w-4" />
                Create Default Schedule
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {DAYS_OF_WEEK.map((day) => {
                const rule = rulesMap.get(day.value);
                const isActive = rule?.is_active ?? false;
                const isWeekend = day.value === 0 || day.value === 6;

                return (
                  <div
                    key={day.value}
                    className={`flex items-center gap-4 p-4 transition-all ${
                      isActive 
                        ? 'bg-gradient-to-r from-slate-800 to-slate-800/50' 
                        : 'bg-slate-900/50'
                    }`}
                  >
                    {/* Day Toggle */}
                    <div className="flex items-center gap-3 w-36">
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) => {
                          if (rule) {
                            saveRuleMutation.mutate({ ...rule, is_active: checked });
                          } else {
                            saveRuleMutation.mutate({
                              clinic_id: clinic.id,
                              day_of_week: day.value,
                              start_time: '09:00',
                              end_time: '17:00',
                              break_start: null,
                              break_end: null,
                              slot_duration_minutes: globalSlotDuration,
                              buffer_minutes: 0,
                              is_active: checked,
                            });
                          }
                        }}
                      />
                      <span className={`font-semibold ${isActive ? 'text-white' : 'text-white/40'}`}>
                        {day.label}
                      </span>
                    </div>

                    {isActive && rule ? (
                      <div className="flex flex-wrap items-center gap-4 flex-1">
                        {/* Hours */}
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-2 border border-slate-700/50">
                          <Sun className="h-4 w-4 text-amber-400" />
                          <Select
                            value={rule.start_time}
                            onValueChange={(val) => saveRuleMutation.mutate({ ...rule, start_time: val })}
                          >
                            <SelectTrigger className="w-28 h-9 rounded-lg bg-slate-800 border-slate-600 text-white font-medium">
                              <SelectValue>
                                {formatTimeDisplay(rule.start_time)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-white hover:bg-slate-700">
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-white/40 font-medium">to</span>
                          <Select
                            value={rule.end_time}
                            onValueChange={(val) => saveRuleMutation.mutate({ ...rule, end_time: val })}
                          >
                            <SelectTrigger className="w-28 h-9 rounded-lg bg-slate-800 border-slate-600 text-white font-medium">
                              <SelectValue>
                                {formatTimeDisplay(rule.end_time)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-white hover:bg-slate-700">
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Moon className="h-4 w-4 text-indigo-400" />
                        </div>

                        {/* Break Time */}
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-2 border border-slate-700/50">
                          <span className="text-sm text-white/60 font-medium">Break:</span>
                          <Select
                            value={rule.break_start || ''}
                            onValueChange={(val) => saveRuleMutation.mutate({ ...rule, break_start: val || null })}
                          >
                            <SelectTrigger className="w-24 h-9 rounded-lg bg-slate-800 border-slate-600 text-white font-medium">
                              <SelectValue placeholder="Start">
                                {rule.break_start ? formatTimeDisplay(rule.break_start) : 'None'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="" className="text-white hover:bg-slate-700">None</SelectItem>
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-white hover:bg-slate-700">
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-white/40 font-medium">to</span>
                          <Select
                            value={rule.break_end || ''}
                            onValueChange={(val) => saveRuleMutation.mutate({ ...rule, break_end: val || null })}
                          >
                            <SelectTrigger className="w-24 h-9 rounded-lg bg-slate-800 border-slate-600 text-white font-medium">
                              <SelectValue placeholder="End">
                                {rule.break_end ? formatTimeDisplay(rule.break_end) : 'None'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="" className="text-white hover:bg-slate-700">None</SelectItem>
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-white hover:bg-slate-700">
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Slot Duration */}
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-2 border border-slate-700/50">
                          <span className="text-sm text-white/60 font-medium">Slot:</span>
                          <Select
                            value={String(rule.slot_duration_minutes)}
                            onValueChange={(val) => saveRuleMutation.mutate({ ...rule, slot_duration_minutes: Number(val) })}
                          >
                            <SelectTrigger className="w-24 h-9 rounded-lg bg-slate-800 border-slate-600 text-white font-medium">
                              <SelectValue>{rule.slot_duration_minutes} min</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {SLOT_DURATIONS.map((d) => (
                                <SelectItem key={d.value} value={String(d.value)} className="text-white hover:bg-slate-700">
                                  {d.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Buffer Minutes */}
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-2 border border-slate-700/50">
                          <span className="text-sm text-white/60 font-medium">Buffer:</span>
                          <Select
                            value={String(rule.buffer_minutes)}
                            onValueChange={(val) => saveRuleMutation.mutate({ ...rule, buffer_minutes: Number(val) })}
                          >
                            <SelectTrigger className="w-24 h-9 rounded-lg bg-slate-800 border-slate-600 text-white font-medium">
                              <SelectValue>{rule.buffer_minutes} min</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="0" className="text-white hover:bg-slate-700">0 min</SelectItem>
                              <SelectItem value="5" className="text-white hover:bg-slate-700">5 min</SelectItem>
                              <SelectItem value="10" className="text-white hover:bg-slate-700">10 min</SelectItem>
                              <SelectItem value="15" className="text-white hover:bg-slate-700">15 min</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <Badge className="bg-slate-700/50 text-white/50 border-0 font-medium">
                          {isWeekend ? 'Weekend - Closed' : 'Closed'}
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked Days */}
      {blockedTimes && blockedTimes.length > 0 && (
        <Card className="#REPLACED# border-slate-700/50 shadow-lg">
          <div className="h-1 bg-gradient-to-r from-coral via-orange-500 to-coral" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CalendarOff className="h-5 w-5 text-coral" />
              Blocked Days
            </CardTitle>
            <CardDescription className="text-white/60">Upcoming unavailable days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {blockedTimes.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-coral/10 border border-coral/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-coral/20 flex items-center justify-center">
                      <CalendarOff className="h-5 w-5 text-coral" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {format(new Date(block.start_datetime), 'EEEE, MMMM d, yyyy')}
                      </p>
                      {block.reason && (
                        <p className="text-sm text-white/60">{block.reason}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteBlockMutation.mutate(block.id)}
                    className="text-coral hover:bg-coral/20 hover:text-coral"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
