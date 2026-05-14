import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderPayload {
  appointmentId: string;
  reminderType: '24h' | '1h';
}

interface AppointmentDetails {
  id: string;
  patient_name: string;
  patient_phone: string;
  clinic_id: string;
  preferred_date: string;
  preferred_time: string;
  confirmed_date: string | null;
  confirmed_time: string | null;
  status: string;
  clinic: {
    id: string;
    name: string;
    address: string;
    phone: string;
  } | null;
  patient: {
    id: string;
    sms_reminder_enabled: boolean;
  } | null;
}

async function getTwilioConfig(supabase: ReturnType<typeof createClient>) {
  const { data: smsSettings } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', 'sms')
    .single();

  const smsConfig = (smsSettings?.value as Record<string, unknown>) || {};
  return {
    accountSid: smsConfig.account_sid as string,
    authToken: smsConfig.auth_token as string,
    fromNumber: smsConfig.from_number as string,
    isEnabled: smsConfig.enabled as boolean,
  };
}

async function sendSMS(
  supabase: ReturnType<typeof createClient>,
  toPhone: string,
  message: string,
  clinicId: string,
  reminderType: string,
  appointmentId: string
): Promise<{ success: boolean; twilioSid?: string; error?: string }> {
  const twilioConfig = await getTwilioConfig(supabase);

  if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.fromNumber) {
    console.warn('Twilio not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  if (!twilioConfig.isEnabled) {
    console.warn('SMS gateway disabled, skipping reminder');
    return { success: false, error: 'SMS gateway disabled' };
  }

  // Format phone number
  let formattedPhone = toPhone.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = `+1${formattedPhone}`;
  } else if (!formattedPhone.startsWith('+')) {
    formattedPhone = `+${formattedPhone}`;
  }

  // Create message record first
  const { data: msgRecord, error: insertError } = await supabase
    .from('clinic_messages')
    .insert({
      clinic_id: clinicId,
      recipient_phone: toPhone,
      message_content: message,
      channel: 'sms',
      direction: 'outbound',
      status: 'pending',
      template_type: `appointment_${reminderType}`,
      appointment_id: appointmentId,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to create message record:', insertError);
    return { success: false, error: insertError.message };
  }

  // Send via Twilio
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Messages.json`;
  const twilioAuth = btoa(`${twilioConfig.accountSid}:${twilioConfig.authToken}`);

  try {
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: twilioConfig.fromNumber,
        Body: message,
      }),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      await supabase
        .from('clinic_messages')
        .update({
          status: 'failed',
          error_message: twilioResult.message || 'SMS send failed',
        })
        .eq('id', msgRecord.id);

      return { success: false, error: twilioResult.message };
    }

    // Update message as sent
    await supabase
      .from('clinic_messages')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: { twilio_sid: twilioResult.sid },
      })
      .eq('id', msgRecord.id);

    console.log(`SMS sent successfully: ${twilioResult.sid}`);
    return { success: true, twilioSid: twilioResult.sid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('clinic_messages')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', msgRecord.id);

    return { success: false, error: errorMessage };
  }
}

async function createReminderLog(
  supabase: ReturnType<typeof createClient>,
  appointmentId: string,
  reminderType: string,
  status: string,
  twilioSid?: string,
  errorMessage?: string
) {
  await supabase
    .from('appointment_reminders')
    .insert({
      appointment_id: appointmentId,
      reminder_type: reminderType,
      status,
      twilio_sid: twilioSid,
      error_message: errorMessage,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: ReminderPayload = await req.json();
    const { appointmentId, reminderType } = payload;

    console.log(`Processing ${reminderType} reminder for appointment: ${appointmentId}`);

    if (!appointmentId || !reminderType) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing appointmentId or reminderType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['24h', '1h'].includes(reminderType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid reminderType. Must be 24h or 1h' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get appointment details with clinic and patient info
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_name,
        patient_phone,
        clinic_id,
        preferred_date,
        preferred_time,
        confirmed_date,
        confirmed_time,
        status,
        clinic:clinics(id, name, address, phone),
        patient:patients(id, sms_reminder_enabled)
      `)
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      console.error('Appointment not found:', apptError);
      return new Response(
        JSON.stringify({ success: false, error: 'Appointment not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appt = appointment as unknown as AppointmentDetails;

    // Check if appointment status allows reminders
    if (!['pending', 'confirmed'].includes(appt.status)) {
      console.log(`Skipping reminder - appointment status is ${appt.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Appointment status ${appt.status} does not allow reminders` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if patient has opted out of SMS reminders
    if (appt.patient && appt.patient.sms_reminder_enabled === false) {
      console.log(`Patient has opted out of SMS reminders`);
      await createReminderLog(supabase, appointmentId, reminderType, 'skipped', undefined, 'Patient opted out of SMS reminders');
      return new Response(
        JSON.stringify({ success: true, message: 'Patient opted out of SMS reminders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this reminder was already sent
    const { data: existingReminder } = await supabase
      .from('appointment_reminders')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('reminder_type', reminderType)
      .eq('status', 'sent')
      .single();

    if (existingReminder) {
      console.log(`Reminder already sent for this appointment`);
      return new Response(
        JSON.stringify({ success: false, error: 'Reminder already sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build message based on reminder type
    const clinicName = appt.clinic?.name || 'the dental clinic';
    const clinicAddress = appt.clinic?.address || '';
    const clinicPhone = appt.clinic?.phone || '';
    const patientName = appt.patient_name;
    const appointmentDate = appt.confirmed_date || appt.preferred_date || 'your scheduled date';
    const appointmentTime = appt.confirmed_time || appt.preferred_time || 'your scheduled time';

    let message = '';

    if (reminderType === '24h') {
      message = `Hi ${patientName}, this is a reminder for your dental appointment at ${clinicName} on ${appointmentDate} at ${appointmentTime}. Reply C to cancel or R to confirm.`;
    } else if (reminderType === '1h') {
      message = `Your appointment at ${clinicName} is in 1 hour. Address: ${clinicAddress}. See you soon!`;
    }

    // Send SMS
    const smsResult = await sendSMS(
      supabase,
      appt.patient_phone,
      message,
      appt.clinic_id,
      reminderType,
      appointmentId
    );

    // Log the reminder attempt
    await createReminderLog(
      supabase,
      appointmentId,
      reminderType,
      smsResult.success ? 'sent' : 'failed',
      smsResult.twilioSid,
      smsResult.error
    );

    if (smsResult.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `${reminderType} reminder sent successfully`,
          twilio_sid: smsResult.twilioSid,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: smsResult.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Send appointment reminder error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});