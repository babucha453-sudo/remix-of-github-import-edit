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

async function triggerSmsReminder(
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

async function triggerEmailReminder(
  appointmentId: string
): Promise<{ success: boolean; error?: string }> {
  const functionUrl = Deno.env.get('SUPABASE_functions_URL') + '/send-email-reminder';
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

    const results: { sms: ReminderResult[]; email: ReminderResult[] } = {
      sms: [],
      email: [],
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
        const reminderType = '24h';

        // Check if SMS reminder already sent
        const { data: existingSms } = await supabase
          .from('appointment_reminders')
          .select('id')
          .eq('appointment_id', appt.id)
          .eq('reminder_type', reminderType)
          .eq('status', 'sent')
          .single();

        if (!existingSms) {
          const smsResult = await triggerSmsReminder(appt.id, reminderType);
          results.sms.push({
            appointmentId: appt.id,
            patientName: appt.patient_name,
            clinicName: appt.clinic?.name || 'Unknown',
            reminderType,
            success: smsResult.success,
            error: smsResult.error,
          });
          console.log(`SMS ${reminderType} reminder ${smsResult.success ? 'sent' : 'failed'} for appointment ${appt.id}`);
        } else {
          console.log(`SMS ${reminderType} reminder already sent for appointment ${appt.id}`);
        }

        // Always send email reminder (dedup handled inside send-email-reminder)
        const emailResult = await triggerEmailReminder(appt.id);
        results.email.push({
          appointmentId: appt.id,
          patientName: appt.patient_name,
          clinicName: appt.clinic?.name || 'Unknown',
          reminderType,
          success: emailResult.success,
          error: emailResult.error,
        });
        console.log(`Email ${reminderType} reminder ${emailResult.success ? 'sent' : 'failed'} for appointment ${appt.id}`);
      }
    } else {
      console.log('No appointments found for 24h reminder window');
    }

    // Process 1-hour reminders
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
        const reminderType = '1h';

        const { data: existingSms } = await supabase
          .from('appointment_reminders')
          .select('id')
          .eq('appointment_id', appt.id)
          .eq('reminder_type', reminderType)
          .eq('status', 'sent')
          .single();

        if (!existingSms) {
          const smsResult = await triggerSmsReminder(appt.id, reminderType);
          results.sms.push({
            appointmentId: appt.id,
            patientName: appt.patient_name,
            clinicName: appt.clinic?.name || 'Unknown',
            reminderType,
            success: smsResult.success,
            error: smsResult.error,
          });
          console.log(`SMS ${reminderType} reminder ${smsResult.success ? 'sent' : 'failed'} for appointment ${appt.id}`);
        } else {
          console.log(`SMS ${reminderType} reminder already sent for appointment ${appt.id}`);
        }

        const emailResult = await triggerEmailReminder(appt.id);
        results.email.push({
          appointmentId: appt.id,
          patientName: appt.patient_name,
          clinicName: appt.clinic?.name || 'Unknown',
          reminderType,
          success: emailResult.success,
          error: emailResult.error,
        });
        console.log(`Email ${reminderType} reminder ${emailResult.success ? 'sent' : 'failed'} for appointment ${appt.id}`);
      }
    } else {
      console.log('No appointments found for 1h reminder window');
    }

    const smsSent = results.sms.filter(r => r.success).length;
    const emailSent = results.email.filter(r => r.success).length;
    console.log(`Summary: SMS: ${smsSent}/${results.sms.length} sent, Email: ${emailSent}/${results.email.length} sent`);

    return new Response(
      JSON.stringify({
        success: true,
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