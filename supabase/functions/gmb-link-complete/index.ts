import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GMB Link Complete
 * 
 * After a dentist signs in with Google (for GMB sync), this function:
 * 1. Validates the pending GMB link request token
 * 2. Assigns the 'dentist' role to the newly signed-in Google user
 * 3. Transfers clinic ownership to the Google user
 * 
 * Uses service role key to bypass RLS for these privileged operations.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Service role client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Use getClaims for JWT verification (handles ES256 signing properly)
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('JWT claims error:', claimsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = claimsData.claims.sub as string;
    console.log(`GMB link complete request from user: ${newUserId}`);

    // Parse body for the link token
    const body = await req.json();
    const linkToken = body.linkToken;

    if (!linkToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing linkToken' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up the pending link request (must be recent and unconsumed)
    const { data: linkRequest, error: lookupError } = await supabaseAdmin
      .from('gmb_link_requests')
      .select('*')
      .eq('token', linkToken)
      .is('consumed_at', null)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // 10 min TTL
      .single();

    if (lookupError || !linkRequest) {
      console.error('Link request not found or expired:', lookupError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired link token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clinic_id, initiated_by } = linkRequest;
    console.log(`Processing GMB link: clinic=${clinic_id}, initiated_by=${initiated_by}, new_user=${newUserId}`);

    // Mark the link request as consumed
    await supabaseAdmin
      .from('gmb_link_requests')
      .update({ consumed_at: new Date().toISOString() })
      .eq('token', linkToken);

    // Check if new user already has dentist role
    const { data: existingRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', newUserId);

    const hasDentistRole = existingRoles?.some(r => r.role === 'dentist');

    // Assign dentist role if not already present
    if (!hasDentistRole) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: newUserId, role: 'dentist' });

      if (roleError) {
        console.error('Failed to assign dentist role:', roleError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to assign dentist role' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`Assigned dentist role to user ${newUserId}`);
    }

    // Transfer clinic ownership to new Google user
    const { error: clinicError } = await supabaseAdmin
      .from('clinics')
      .update({
        claimed_by: newUserId,
        claimed_at: new Date().toISOString(),
        claim_status: 'claimed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clinic_id);

    if (clinicError) {
      console.error('Failed to transfer clinic ownership:', clinicError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to transfer clinic ownership' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Clinic ${clinic_id} ownership transferred to ${newUserId}`);

    // Log to audit
    await supabaseAdmin.from('audit_logs').insert({
      action: 'GMB_LINK_COMPLETE',
      entity_type: 'clinic',
      entity_id: clinic_id,
      user_id: newUserId,
      new_values: {
        previous_owner: initiated_by,
        new_owner: newUserId,
        transfer_type: 'gmb_oauth',
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'GMB link complete: role assigned and clinic ownership transferred',
        clinicId: clinic_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GMB link complete error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
