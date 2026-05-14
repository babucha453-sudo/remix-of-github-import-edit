import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingCheck {
  dentistId: string;
  clinicId: string | null;
  email: string;
  firstName: string;
  clinicName: string;
  registrationDate: string;
  lastEmailSentDay: number | null;
  lastEmailSentAt: string | null;
}

async function getOnboardingData(supabase: any): Promise<OnboardingCheck[]> {
  const now = new Date();
  const day0 = new Date(now);
  day0.setDate(day0.getDate());
  
  const day3 = new Date(now);
  day3.setDate(day3.getDate() - 3);
  
  const day7 = new Date(now);
  day7.setDate(day7.getDate() - 7);

  const { data: dentists } = await supabase
    .from('dentists')
    .select('id, email, first_name, clinic_name, created_at')
    .eq('status', 'active')
    .gte('created_at', new Date(day7.setDate(day7.getDate() - 7)).toISOString())
    .lte('created_at', now.toISOString());

  if (!dentists || dentists.length === 0) {
    console.log('No recent dentists found for onboarding check');
    return [];
  }

  const { data: clinics } = await supabase
    .from('clinics')
    .select('id, name, dentist_id')
    .in('dentist_id', dentists.map((d: any) => d.id));

  const { data: emailLogs } = await supabase
    .from('email_logs')
    .select('dentist_id, type, created_at')
    .in('type', ['welcome_email', 'onboarding_day_0', 'onboarding_day_3', 'onboarding_day_7'])
    .gte('created_at', new Date(day7.getTime()).toISOString());

  return dentists.map((dentist: any) => {
    const clinic = clinics?.find((c: any) => c.dentist_id === dentist.id);
    const dentistEmails = emailLogs?.filter((e: any) => e.dentist_id === dentist.id) || [];
    
    let lastEmailDay: number | null = null;
    let lastEmailAt: string | null = null;
    
    if (dentistEmails.length > 0) {
      const sorted = dentistEmails.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestEmail = sorted[0];
      
      if (latestEmail.type === 'onboarding_day_7' || latestEmail.type === 'welcome_email') {
        lastEmailDay = 7;
      } else if (latestEmail.type === 'onboarding_day_3') {
        lastEmailDay = 3;
      } else if (latestEmail.type === 'onboarding_day_0') {
        lastEmailDay = 0;
      }
      lastEmailAt = latestEmail.created_at;
    }

    return {
      dentistId: dentist.id,
      clinicId: clinic?.id || null,
      email: dentist.email,
      firstName: dentist.first_name,
      clinicName: clinic?.name || dentist.clinic_name || 'Your Clinic',
      registrationDate: dentist.created_at,
      lastEmailSentDay: lastEmailDay,
      lastEmailSentAt: lastEmailAt,
    };
  });
}

async function sendWelcomeEmail(supabase: any, data: OnboardingCheck): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const functionUrl = `${supabaseUrl}/functions/v1/send-welcome-email`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      dentistId: data.dentistId,
      clinicId: data.clinicId,
      email: data.email,
      firstName: data.firstName,
      clinicName: data.clinicName,
    }),
  });

  const result = await response.json();
  return result.success === true;
}

async function sendOnboardingEmail(supabase: any, data: OnboardingCheck, day: number): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const functionUrl = `${supabaseUrl}/functions/v1/send-onboarding-sequence`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      dentistId: data.dentistId,
      clinicId: data.clinicId,
      email: data.email,
      firstName: data.firstName,
      clinicName: data.clinicName,
      sequenceDay: day,
    }),
  });

  const result = await response.json();
  return result.success === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const forceRun = url.searchParams.get('force') === 'true';
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr) : 50;

    console.log(`Running onboarding trigger check${forceRun ? ' (forced)' : ''}`);

    const onboardingData = await getOnboardingData(supabase);
    
    if (onboardingData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No dentists need onboarding emails',
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { dentistId: string; email: string; action: string; success: boolean }[] = [];
    const now = new Date();

    for (const data of onboardingData.slice(0, limit)) {
      const regDate = new Date(data.registrationDate);
      const daysSinceRegistration = Math.floor((now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Processing ${data.email}: ${daysSinceRegistration} days since registration, last email: day ${data.lastEmailSentDay}`);

      if (data.lastEmailSentDay === null) {
        const sent = await sendWelcomeEmail(supabase, data);
        results.push({ dentistId: data.dentistId, email: data.email, action: 'welcome_email', success: sent });
        console.log(`Sent welcome email to ${data.email}: ${sent}`);
      } 
      else if (data.lastEmailSentDay === 0 && daysSinceRegistration >= 3) {
        const sent = await sendOnboardingEmail(supabase, data, 3);
        results.push({ dentistId: data.dentistId, email: data.email, action: 'onboarding_day_3', success: sent });
        console.log(`Sent day 3 email to ${data.email}: ${sent}`);
      }
      else if (data.lastEmailSentDay === 3 && daysSinceRegistration >= 7) {
        const sent = await sendOnboardingEmail(supabase, data, 7);
        results.push({ dentistId: data.dentistId, email: data.email, action: 'onboarding_day_7', success: sent });
        console.log(`Sent day 7 email to ${data.email}: ${sent}`);
      }
      else if (daysSinceRegistration >= 3 && data.lastEmailSentDay === null) {
        const sent = await sendOnboardingEmail(supabase, data, 0);
        results.push({ dentistId: data.dentistId, email: data.email, action: 'onboarding_day_0', success: sent });
      }
      else {
        console.log(`No email needed for ${data.email} (day ${data.lastEmailSentDay}, ${daysSinceRegistration} days since reg)`);
      }
    }

    const successCount = results.filter(r => r.success).length;

    await supabase.from('automation_logs').insert({
      type: 'onboarding_trigger',
      status: 'completed',
      details: { 
        processed: results.length, 
        successful: successCount,
        failed: results.length - successCount,
        results 
      },
    });

    console.log(`Onboarding trigger completed: ${successCount}/${results.length} emails sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        successful: successCount,
        failed: results.length - successCount,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in onboarding-trigger:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});