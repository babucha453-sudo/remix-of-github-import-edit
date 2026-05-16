import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationResult {
  processed: number;
  day0Sent: number;
  day3Sent: number;
  day7Sent: number;
  errors: string[];
}

async function triggerReviewRequest(
  supabase: ReturnType<typeof createClient>,
  appointmentId: string,
  step: number
): Promise<{ success: boolean; error?: string }> {
  const functionUrl = Deno.env.get('SUPABASE_functions_URL') + '/review-request-automation';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        appointmentId,
        sequenceStep: step,
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
    console.log(`Review automation trigger running at ${now.toISOString()}`);

    const result: AutomationResult = {
      processed: 0,
      day0Sent: 0,
      day3Sent: 0,
      day7Sent: 0,
      errors: []
    };

    const day0Appointments = await supabase
      .from('appointments')
      .select('id, clinic_id, completed_at')
      .eq('status', 'completed')
      .lte('completed_at', now.toISOString())
      .is('review_requested', null);

    if (day0Appointments.data && day0Appointments.data.length > 0) {
      console.log(`Found ${day0Appointments.data.length} completed appointments needing Day 0 review request`);
      
      for (const appointment of day0Appointments.data) {
        const triggerResult = await triggerReviewRequest(supabase, appointment.id, 0);
        if (triggerResult.success) {
          result.day0Sent++;
          result.processed++;
          
          await supabase
            .from('appointments')
            .update({ 
              review_requested: true,
              review_requested_at: now.toISOString()
            })
            .eq('id', appointment.id);
        } else {
          result.errors.push(`Day 0 for ${appointment.id}: ${triggerResult.error}`);
        }
      }
    }

    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const day3Appointments = await supabase
      .from('appointments')
      .select('id, completed_at')
      .eq('status', 'completed')
      .eq('review_requested', true)
      .eq('review_status', 'pending')
      .not('review_requested_at', 'is', null)
      .lte('completed_at', threeDaysAgo.toISOString());

    if (day3Appointments.data && day3Appointments.data.length > 0) {
      console.log(`Found ${day3Appointments.data.length} appointments needing Day 3 reminder`);

      for (const appointment of day3Appointments.data) {
        const hasDay3 = await supabase
          .from('review_automation_log')
          .select('id')
          .eq('appointment_id', appointment.id)
          .eq('sequence_step', 3)
          .maybeSingle();

        if (!hasDay3) {
          const triggerResult = await triggerReviewRequest(supabase, appointment.id, 3);
          if (triggerResult.success) {
            result.day3Sent++;
            result.processed++;
          } else {
            result.errors.push(`Day 3 for ${appointment.id}: ${triggerResult.error}`);
          }
        }
      }
    }

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const day7Appointments = await supabase
      .from('appointments')
      .select('id, completed_at')
      .eq('status', 'completed')
      .eq('review_requested', true)
      .eq('review_status', 'pending')
      .not('review_requested_at', 'is', null)
      .lte('completed_at', sevenDaysAgo.toISOString());

    if (day7Appointments.data && day7Appointments.data.length > 0) {
      console.log(`Found ${day7Appointments.data.length} appointments needing Day 7 final reminder`);

      for (const appointment of day7Appointments.data) {
        const hasDay7 = await supabase
          .from('review_automation_log')
          .select('id')
          .eq('appointment_id', appointment.id)
          .eq('sequence_step', 7)
          .maybeSingle();

        if (!hasDay7) {
          const triggerResult = await triggerReviewRequest(supabase, appointment.id, 7);
          if (triggerResult.success) {
            result.day7Sent++;
            result.processed++;
          } else {
            result.errors.push(`Day 7 for ${appointment.id}: ${triggerResult.error}`);
          }
        }
      }
    }

    await supabase.from('automation_run_log').insert({
      automation_type: 'review_request',
      triggered_at: now.toISOString(),
      appointments_processed: result.processed,
      day0_sent: result.day0Sent,
      day3_sent: result.day3Sent,
      day7_sent: result.day7Sent,
      errors: result.errors.length > 0 ? result.errors : null,
      status: result.errors.length === 0 ? 'success' : 'partial_success'
    });

    console.log(`Review automation complete:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Review automation completed',
        ...result
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error('Error in review-automation-trigger:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});