import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, generateReviewRequestHTML } from "../_shared/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewRequestPayload {
  clinicId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName: string;
  channel: 'email' | 'sms' | 'whatsapp';
  customMessage?: string;
  appointmentId?: string;
  autoTrigger?: boolean;
  sequenceStep?: number;
}

interface ClinicBranding {
  name: string;
  logo?: string;
  primaryColor: string;
  slug: string;
  googlePlaceId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Twilio credentials from global_settings table (API Control tab)
    const { data: smsSettings } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'sms')
      .single();

    const { data: whatsappSettings } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'whatsapp')
      .single();

    const smsConfig = (smsSettings?.value as Record<string, unknown>) || {};
    const twilioAccountSid = smsConfig.account_sid as string;
    const twilioAuthToken = smsConfig.auth_token as string;
    const twilioFromNumber = smsConfig.from_number as string;
    const smsEnabled = smsConfig.enabled as boolean;

    const whatsappConfig = (whatsappSettings?.value as Record<string, unknown>) || {};
    const whatsappEnabled = whatsappConfig.enabled as boolean;
    // Use WhatsApp-specific number if configured, otherwise use Twilio Sandbox default
    const whatsappFromNumber = (whatsappConfig.from_number as string) || '+14155238886';

    const payload: ReviewRequestPayload = await req.json();
    const { clinicId, recipientEmail, recipientPhone, recipientName, channel, customMessage, appointmentId, autoTrigger, sequenceStep } = payload;

    console.log(`Processing review request for ${channel} to ${recipientEmail || recipientPhone}`);

    let clinicIdToUse = clinicId;

    if (autoTrigger && appointmentId) {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('clinic_id, patient_name, patient_email, patient_phone')
        .eq('id', appointmentId)
        .single();
      
      if (apptData) {
        clinicIdToUse = apptData.clinic_id;
      }
    }

    // Fetch clinic data
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, slug, cover_image_url, google_place_id')
      .eq('id', clinicIdToUse)
      .maybeSingle();

    if (clinicError) {
      console.error('Database error fetching clinic:', clinicError);
      throw new Error(`Database error: ${clinicError.message}`);
    }

    if (!clinic) {
      console.error(`Clinic with ID ${clinicId} not found`);
      throw new Error('Clinic not found');
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://appointpanda.com';
    const reviewLink = `${siteUrl}/review/${clinic.slug}`;
    const googleReviewLink = clinic.google_place_id 
      ? `https://search.google.com/local/writereview?placeid=${clinic.google_place_id}`
      : null;

    let success = false;
    let errorMessage = '';

    // Handle Email
    if (channel === 'email') {
      if (!resendApiKey) {
        throw new Error('Email service not configured');
      }
      if (!recipientEmail) {
        throw new Error('Email address required');
      }

      const htmlContent = generateReviewRequestHTML({
        patientName: recipientName,
        clinicName: clinic.name,
        clinicLogo: clinic.cover_image_url || undefined,
        reviewLink,
        googleReviewLink: googleReviewLink || undefined,
        customMessage: customMessage || undefined,
        primaryColor: '#0d9488',
      });

      const subject = `${recipientName}, how was your visit to ${clinic.name}?`;
      const result = await sendEmail(resendApiKey, recipientEmail, subject, htmlContent, {
        from: `${clinic.name} <no-reply@appointpanda.com>`,
      });

      await logEmail(supabase, {
        recipient: recipientEmail,
        subject,
        type: 'review_request',
        status: result.success ? 'sent' : 'failed',
        error_message: result.error,
        resend_id: result.id,
        clinic_id: clinic.id,
        appointment_id: appointmentId || undefined,
      });

      if (result.success) {
        success = true;
      } else {
        console.error('Resend error:', result.error);
        errorMessage = `Email failed: ${result.error}`;
      }
    }

    // Handle SMS
    if (channel === 'sms') {
      if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
        throw new Error('SMS service not configured in API Control tab. Please add Twilio credentials.');
      }
      if (!smsEnabled) {
        throw new Error('SMS gateway is disabled in API Control tab');
      }
      if (!recipientPhone) {
        throw new Error('Phone number required');
      }

      const message = customMessage || 
        `Hi ${recipientName}! Thanks for visiting ${clinic.name}. We'd love your feedback: ${reviewLink}`;

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: recipientPhone,
          From: twilioFromNumber,
          Body: message,
        }),
      });

      if (response.ok) {
        success = true;
      } else {
        const errorBody = await response.text();
        console.error('Twilio SMS error:', errorBody);
        errorMessage = `SMS failed: ${errorBody}`;
      }
    }

    // Handle WhatsApp
    if (channel === 'whatsapp') {
      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error('WhatsApp service not configured in API Control tab. Please add Twilio credentials.');
      }
      if (!whatsappEnabled) {
        throw new Error('WhatsApp is disabled in API Control tab');
      }
      if (!recipientPhone) {
        throw new Error('Phone number required');
      }

      const message = customMessage || 
        `Hi ${recipientName}! 👋\n\nThank you for visiting *${clinic.name}*!\n\nWe'd love to hear about your experience. Please take a moment to share your feedback:\n\n${reviewLink}\n\nThank you! ⭐`;

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      console.log(`Sending WhatsApp to ${recipientPhone} from ${whatsappFromNumber}`);

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:${recipientPhone}`,
          From: `whatsapp:${whatsappFromNumber}`,
          Body: message,
        }),
      });

      if (response.ok) {
        success = true;
      } else {
        const errorBody = await response.text();
        console.error('Twilio WhatsApp error:', errorBody);
        errorMessage = `WhatsApp failed: ${errorBody}`;
      }
    }

    // Log the request to review_requests
    await supabase.from('review_requests').insert({
      clinic_id: clinicIdToUse,
      appointment_id: appointmentId || null,
      patient_name: recipientName,
      patient_email: recipientEmail,
      patient_phone: recipientPhone,
      channel,
      status: success ? 'sent' : 'failed',
      sent_at: success ? new Date().toISOString() : null,
    });

    // Log to review_automation_log for automation tracking
    await supabase.from('review_automation_log').insert({
      appointment_id: appointmentId || null,
      clinic_id: clinicIdToUse,
      patient_name: recipientName,
      patient_email: recipientEmail,
      patient_phone: recipientPhone,
      sequence_step: sequenceStep || 0,
      channel,
      status: success ? 'sent' : 'failed',
      email_sent: channel === 'email' ? success : false,
      sms_sent: channel === 'sms' ? success : false,
      sent_at: success ? new Date().toISOString() : null,
    });

    if (success && appointmentId) {
      await supabase
        .from('appointments')
        .update({ 
          review_requested: true,
          review_requested_at: new Date().toISOString()
        })
        .eq('id', appointmentId);
    }

    if (!success && errorMessage) {
      throw new Error(errorMessage);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Review request sent successfully' }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: unknown) {
    console.error('Error in send-review-request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});
