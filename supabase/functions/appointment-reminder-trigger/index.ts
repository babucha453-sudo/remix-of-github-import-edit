import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderResult {
  appointmentId: string;
  patientName: string;
  clinicName: string;
  reminderType: string;
  success: boolean;
  error?: string;
}

async function triggerReminder(
  appointmentId: string,
  reminderType: '24h' | '1h'
): Promise<{ success: boolean; error?: string }> {
  const functionUrl = Deno.env.get('SUPABASE_functions_URL') + '/send-appointment-reminder';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        appointmentId,
        reminderType,
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    console.log(`Appointment reminder trigger running at ${now.toISOString()}`);

    const results: ReminderResult[] = {
      h24: [],
      h1: [],
    };

    // Process 24-hour reminders
    // Find appointments scheduled for tomorrow (24-48 hours from now)
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);
    tomorrowEnd.setHours(0, 0, 0, 0);

    // Use start_datetime for precise filtering
    const { data: day24Appointments, error: day24Error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_name,
        clinic_id,
        status,
        start_datetime,
        clinic:clinics(name)
      `)
      .in('status', ['pending', 'confirmed'])
      .gte('start_datetime', tomorrowStart.toISOString())
      .lt('start_datetime', tomorrowEnd.toISOString());

    if (day24Error) {
      console.error('Error fetching 24h appointments:', day24Error);
    }

    if (day24Appointments && day24Appointments.length > 0) {
      console.log(`Found ${day24Appointments.length} appointments for 24h reminder window`);

      for (const appt of day24Appointments) {
        // Check if 24h reminder already sent
        const { data: existingReminder } = await supabase
          .from('appointment_reminders')
          .select('id')
          .eq('appointment_id', appt.id)
          .eq('reminder_type', '24h')
          .eq('status', 'sent')
          .single();

        if (existingReminder) {
          console.log(`24h reminder already sent for appointment ${appt.id}`);
          continue;
        }

        const triggerResult = await triggerReminder(appt.id, '24h');
        
        results.h24.push({
          appointmentId: appt.id,
          patientName: appt.patient_name,
          clinicName: appt.clinic?.name || 'Unknown',
          reminderType: '24h',
          success: triggerResult.success,
          error: triggerResult.error,
        });

        console.log(`24h reminder ${triggerResult.success ? 'sent' : 'failed'} for appointment ${appt.id}`);
      }
    } else {
      console.log('No appointments found for 24h reminder window');
    }

    // Process 1-hour reminders
    // Find appointments starting in 30-90 minutes
    const oneHourStart = new Date(now);
    oneHourStart.setMinutes(oneHourStart.getMinutes() + 30);

    const oneHourEnd = new Date(now);
    oneHourEnd.setMinutes(oneHourEnd.getMinutes() + 90);

    const { data: hour1Appointments, error: hour1Error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_name,
        clinic_id,
        status,
        start_datetime,
        clinic:clinics(name)
      `)
      .in('status', ['pending', 'confirmed'])
      .gte('start_datetime', oneHourStart.toISOString())
      .lt('start_datetime', oneHourEnd.toISOString());

    if (hour1Error) {
      console.error('Error fetching 1h appointments:', hour1Error);
    }

    if (hour1Appointments && hour1Appointments.length > 0) {
      console.log(`Found ${hour1Appointments.length} appointments for 1h reminder window`);

      for (const appt of hour1Appointments) {
        // Check if 1h reminder already sent
        const { data: existingReminder } = await supabase
          .from('appointment_reminders')
          .select('id')
          .eq('appointment_id', appt.id)
          .eq('reminder_type', '1h')
          .eq('status', 'sent')
          .single();

        if (existingReminder) {
          console.log(`1h reminder already sent for appointment ${appt.id}`);
          continue;
        }

        const triggerResult = await triggerReminder(appt.id, '1h');
        
        results.h1.push({
          appointmentId: appt.id,
          patientName: appt.patient_name,
          clinicName: appt.clinic?.name || 'Unknown',
          reminderType: '1h',
          success: triggerResult.success,
          error: triggerResult.error,
        });

        console.log(`1h reminder ${triggerResult.success ? 'sent' : 'failed'} for appointment ${appt.id}`);
      }
    } else {
      console.log('No appointments found for 1h reminder window');
    }

    const total24h = results.h24.length;
    const success24h = results.h24.filter(r => r.success).length;
    const total1h = results.h1.length;
    const success1h = results.h1.filter(r => r.success).length;

    console.log(`Summary: 24h: ${success24h}/${total24h} sent, 1h: ${success1h}/${total1h} sent`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: {
          h24: { total: total24h, sent: success24h },
          h1: { total: total1h, sent: success1h },
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Appointment reminder trigger error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});