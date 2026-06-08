import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, getEmailSettings, generateOnboardingReminderHTML, generateWelcomeEmailHTML } from "../_shared/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingSequencePayload {
  dentistId: string;
  clinicId?: string;
  email: string;
  firstName: string;
  clinicName: string;
  sequenceDay?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: OnboardingSequencePayload = await req.json();
    const { dentistId, clinicId, email, firstName, clinicName, sequenceDay } = payload;

    if (!email || !firstName || sequenceDay === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailSettings = await getEmailSettings(supabase);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://www.appointpanda.com';
    const profileUrl = clinicId ? `${siteUrl}/clinic/${clinicId}/edit` : `${siteUrl}/dashboard/profile`;
    const dashboardUrl = `${siteUrl}/dashboard`;

    let subject: string;
    let html: string;

    if (sequenceDay === 0) {
      subject = `Welcome to AppointPanda, ${firstName}!`;
      html = generateWelcomeEmailHTML({
        firstName,
        clinicName: clinicName || 'Your Clinic',
        profileUrl,
        dashboardUrl,
      });
    } else if (sequenceDay === 3) {
      subject = `Complete your ${clinicName} profile - 3-day reminder`;
      let completionPercent = 50;
      if (clinicId) {
        const { data: clinic } = await supabase.from('clinics').select('profile_completion').eq('id', clinicId).single();
        completionPercent = clinic?.profile_completion || 50;
      }
      html = generateOnboardingReminderHTML({
        firstName,
        clinicName: clinicName || 'Your Clinic',
        profileUrl,
        completionPercent,
        day: 3,
      });
    } else if (sequenceDay === 7) {
      subject = `${firstName}, tips to get more dental bookings`;
      html = generateOnboardingReminderHTML({
        firstName,
        clinicName: clinicName || 'Your Clinic',
        profileUrl,
        day: 7,
      });
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid sequence day. Use 0, 3, or 7.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const from = `${emailSettings.from_name} <${emailSettings.from_email}>`;
    const result = await sendEmail(resendApiKey, email, subject, html, { from });

    await logEmail(supabase, {
      recipient: email,
      subject,
      type: `onboarding_day_${sequenceDay}`,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error,
      resend_id: result.id,
      clinic_id: clinicId,
      user_id: dentistId,
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
