import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  appointmentId: string;
  newStatus: string;
  oldStatus?: string;
  confirmedDate?: string;
  confirmedTime?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    const { appointmentId, newStatus, oldStatus, confirmedDate, confirmedTime } = payload;

    console.log(`Appointment notification: ${appointmentId} status changed from ${oldStatus} to ${newStatus}`);

    if (!appointmentId || !newStatus) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing appointmentId or newStatus' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get appointment details with clinic info
    // Use explicit foreign key reference to avoid ambiguity with original_clinic_id
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*, clinic:clinics!appointments_clinic_id_fkey(id, name, address, phone)')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      console.error('Appointment not found:', apptError);
      return new Response(
        JSON.stringify({ success: false, error: 'Appointment not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twilio credentials from global_settings table (API Control tab)
    const { data: smsSettings, error: settingsError } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'sms')
      .single();

    if (settingsError || !smsSettings) {
      console.error('SMS settings not found in global_settings:', settingsError);
    }

    const smsConfig = (smsSettings?.value as Record<string, unknown>) || {};
    const twilioAccountSid = smsConfig.account_sid as string;
    const twilioAuthToken = smsConfig.auth_token as string;
    const twilioFromNumber = smsConfig.from_number as string;
    const isEnabled = smsConfig.enabled as boolean;

    console.log('Twilio config loaded:', { 
      hasSid: !!twilioAccountSid, 
      hasToken: !!twilioAuthToken, 
      hasFrom: !!twilioFromNumber,
      enabled: isEnabled 
    });

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      console.warn('Twilio not configured in API Control tab, skipping SMS notification');
      
      // Log the failed notification attempt
      await supabase.from('clinic_messages').insert({
        clinic_id: appointment.clinic_id,
        recipient_phone: appointment.patient_phone,
        message_content: `Status changed to ${newStatus}`,
        channel: 'sms',
        direction: 'outbound',
        status: 'failed',
        error_message: 'Twilio API not configured in API Control tab',
        template_type: `status_${newStatus}`,
      });

      return new Response(
        JSON.stringify({ success: false, error: 'Twilio not configured in API Control tab. Please add Account SID, Auth Token, and From Number.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isEnabled) {
      console.warn('SMS gateway is disabled in API Control tab');
      return new Response(
        JSON.stringify({ success: false, error: 'SMS gateway is disabled in API Control tab' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the notification message based on status
    let message = '';
    const clinicName = appointment.clinic?.name || 'the dental clinic';
    const patientName = appointment.patient_name;
    const appointmentDate = confirmedDate || appointment.confirmed_date || appointment.preferred_date || 'your scheduled date';
    const appointmentTime = confirmedTime || appointment.confirmed_time || appointment.preferred_time || 'your scheduled time';
    const clinicPhone = appointment.clinic?.phone || '';
    const clinicAddress = appointment.clinic?.address || '';

    switch (newStatus) {
      case 'confirmed':
        message = `✅ Booking Confirmed!\n\nHi ${patientName}, your appointment at ${clinicName} is confirmed for ${appointmentDate} at ${appointmentTime}.\n\n📍 Address: ${clinicAddress || 'See clinic for details'}\n\nNeed to reschedule? Reply RESCHEDULE or call ${clinicPhone || 'the clinic'}.`;
        break;
      case 'completed':
        message = `Thank you for visiting ${clinicName}, ${patientName}! We hope you had a great experience. If you'd like to leave a review, we'd really appreciate it! 🦷`;
        break;
      case 'cancelled':
        message = `Hi ${patientName}, your appointment at ${clinicName} has been cancelled. If you'd like to reschedule, please call ${clinicPhone || 'the clinic'} or book online.`;
        break;
      case 'no_show':
        message = `Hi ${patientName}, we missed you at your appointment at ${clinicName}. If you'd like to reschedule, please call ${clinicPhone || 'the clinic'}.`;
        break;
      case 'pending':
        message = `Hi ${patientName}, we've received your booking request at ${clinicName} for ${appointmentDate}. We'll confirm your appointment shortly!`;
        break;
      default:
        message = `Hi ${patientName}, your appointment status at ${clinicName} has been updated to: ${newStatus}.`;
    }

    // Create message record
    const { data: msgRecord, error: insertError } = await supabase
      .from('clinic_messages')
      .insert({
        clinic_id: appointment.clinic_id,
        recipient_phone: appointment.patient_phone,
        message_content: message,
        channel: 'sms',
        direction: 'outbound',
        status: 'pending',
        template_type: `status_${newStatus}`,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create message record:', insertError);
      throw insertError;
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Format phone number (ensure it has country code)
    let toPhone = appointment.patient_phone.replace(/\D/g, '');
    if (toPhone.length === 10) {
      toPhone = `+1${toPhone}`; // Assume US if 10 digits
    } else if (!toPhone.startsWith('+')) {
      toPhone = `+${toPhone}`;
    }

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toPhone,
        From: twilioFromNumber,
        Body: message,
      }),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioResult);
      
      // Update message as failed
      await supabase
        .from('clinic_messages')
        .update({
          status: 'failed',
          error_message: twilioResult.message || 'SMS send failed',
        })
        .eq('id', msgRecord.id);

      return new Response(
        JSON.stringify({ success: false, error: twilioResult.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    console.log(`SMS sent successfully to ${toPhone}: ${twilioResult.sid}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: msgRecord.id, 
        twilio_sid: twilioResult.sid,
        status: newStatus 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Appointment notification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
