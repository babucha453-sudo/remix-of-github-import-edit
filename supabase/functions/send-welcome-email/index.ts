import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, getEmailSettings, generateWelcomeEmailHTML } from "../_shared/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeEmailPayload {
  dentistId: string;
  clinicId?: string;
  email: string;
  firstName: string;
  clinicName: string;
  claimToken?: string;
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

    const payload: WelcomeEmailPayload = await req.json();
    const { dentistId, clinicId, email, firstName, clinicName, claimToken } = payload;

    if (!email || !firstName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: email and firstName' }),
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

    const profileUrl = clinicId
      ? `${siteUrl}/clinic/${clinicId}/edit`
      : `${siteUrl}/dashboard/profile`;
    const dashboardUrl = `${siteUrl}/dashboard`;

    const subject = `Welcome to AppointPanda, ${firstName}!`;
    const html = generateWelcomeEmailHTML({
      firstName,
      clinicName: clinicName || 'Your Clinic',
      profileUrl,
      dashboardUrl,
      logoUrl: undefined,
    });

    const from = `${emailSettings.from_name} <${emailSettings.from_email}>`;
    const result = await sendEmail(resendApiKey, email, subject, html, { from });

    await logEmail(supabase, {
      recipient: email,
      subject,
      type: 'welcome_email',
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
