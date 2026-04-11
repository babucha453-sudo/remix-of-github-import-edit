import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const ExecuteRuleSchema = z.object({
  action: z.literal('execute-rule'),
  ruleId: z.string().uuid("Invalid rule ID format"),
});

const RunAllSchema = z.object({
  action: z.literal('run-all'),
});

const RequestSchema = z.discriminatedUnion('action', [
  ExecuteRuleSchema,
  RunAllSchema,
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // SECURITY FIX: Require authentication for automation functions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'district_manager']);
    
    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse and validate input
    const body = await req.json();
    const validationResult = RequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.issues);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid input', 
          details: validationResult.error.issues.map(i => i.message)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const params = validationResult.data;
    console.log(`Running automation: ${params.action}`, 'ruleId' in params ? `Rule: ${params.ruleId}` : 'All enabled rules', `by ${user.email}`);

    switch (params.action) {
      case 'execute-rule': {
        const { ruleId } = params;

        // Get rule
        const { data: rule, error: ruleError } = await supabase
          .from('automation_rules')
          .select('*')
          .eq('id', ruleId)
          .single();
        
        if (ruleError || !rule) {
          return new Response(
            JSON.stringify({ success: false, error: 'Rule not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await executeRule(supabase, rule);
        
        // Update rule stats
        await supabase
          .from('automation_rules')
          .update({
            run_count: (rule.run_count || 0) + 1,
            last_run_at: new Date().toISOString(),
          })
          .eq('id', ruleId);
        
        // Log execution
        await supabase.from('automation_logs').insert({
          rule_id: ruleId,
          status: result.success ? 'success' : 'failed',
          error_message: result.error,
          details: result.details,
        });
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'run-all': {
        // Get all enabled rules
        const { data: rules } = await supabase
          .from('automation_rules')
          .select('*')
          .eq('is_enabled', true);
        
        const results = [];
        
        for (const rule of rules || []) {
          const result = await executeRule(supabase, rule);
          
          // Update rule stats
          await supabase
            .from('automation_rules')
            .update({
              run_count: (rule.run_count || 0) + 1,
              last_run_at: new Date().toISOString(),
            })
            .eq('id', rule.id);
          
          // Log execution
          await supabase.from('automation_logs').insert({
            rule_id: rule.id,
            status: result.success ? 'success' : 'failed',
            error_message: result.error,
            details: result.details,
          });
          
          results.push({ rule_id: rule.id, name: rule.name, ...result });
        }
        
        return new Response(
          JSON.stringify({ success: true, executed: results.length, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Automation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeRule(supabase: any, rule: any) {
  const trigger = rule.trigger_config || {};
  const action = rule.action_config || {};
  
  try {
    switch (rule.rule_type) {
      case 'lead_followup': {
        // Find leads that need follow-up
        const hoursOld = trigger.hours_since_created || 24;
        const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
        
        const { data: leads } = await supabase
          .from('leads')
          .select('id, patient_name, patient_email, clinic_id')
          .eq('status', 'new')
          .lt('created_at', cutoffTime)
          .limit(action.max_per_run || 50);
        
        // Update leads to contacted status
        if (leads && leads.length > 0) {
          const leadIds = leads.map((l: any) => l.id);
          await supabase
            .from('leads')
            .update({ status: 'contacted', contacted_at: new Date().toISOString() })
            .in('id', leadIds);
        }
        
        return {
          success: true,
          details: { leads_processed: leads?.length || 0 },
        };
      }

      case 'appointment_reminder': {
        // Find appointments needing reminders
        const daysAhead = trigger.days_ahead || 1;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysAhead);
        const dateStr = targetDate.toISOString().split('T')[0];
        
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id, patient_name, patient_email, confirmed_date')
          .eq('status', 'confirmed')
          .eq('confirmed_date', dateStr)
          .limit(action.max_per_run || 100);
        
        // Log reminders to be sent (actual sending would require email integration)
        return {
          success: true,
          details: { 
            reminders_queued: appointments?.length || 0,
            target_date: dateStr,
          },
        };
      }

      case 'review_request': {
        // Find completed appointments without reviews
        const daysSinceCompleted = trigger.days_since_completed || 3;
        const cutoffTime = new Date(Date.now() - daysSinceCompleted * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id, patient_email, clinic_id')
          .eq('status', 'completed')
          .lt('updated_at', cutoffTime)
          .limit(action.max_per_run || 50);
        
        return {
          success: true,
          details: { review_requests_queued: appointments?.length || 0 },
        };
      }

      case 'data_cleanup': {
        // Mark old unclaimed clinics as needing review
        const daysOld = trigger.days_without_claim || 90;
        const cutoffTime = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: clinics, count } = await supabase
          .from('clinics')
          .select('id', { count: 'exact' })
          .eq('claim_status', 'unclaimed')
          .eq('source', 'gmb')
          .lt('created_at', cutoffTime);
        
        // Create platform alert for admin review
        if (clinics && clinics.length > 0) {
          await supabase.from('platform_alerts').insert({
            alert_type: 'data_cleanup',
            title: `${clinics.length} unclaimed GMB listings need review`,
            message: `These clinics have been unclaimed for over ${daysOld} days.`,
            severity: 'info',
          });
        }
        
        return {
          success: true,
          details: { clinics_flagged: count || 0 },
        };
      }

      case 'duplicate_detection': {
        // Find potential duplicates based on phone/address similarity
        const { data: clinics } = await supabase
          .from('clinics')
          .select('id, name, phone, address')
          .eq('is_duplicate', false)
          .limit(500);
        
        const duplicateGroups: string[][] = [];
        const processed = new Set<string>();
        
        // Simple duplicate detection by phone
        const phoneMap = new Map<string, string[]>();
        clinics?.forEach((clinic: any) => {
          if (clinic.phone) {
            const normalizedPhone = clinic.phone.replace(/\D/g, '').slice(-9);
            if (!phoneMap.has(normalizedPhone)) {
              phoneMap.set(normalizedPhone, []);
            }
            phoneMap.get(normalizedPhone)!.push(clinic.id);
          }
        });
        
        let duplicatesFound = 0;
        for (const [phone, ids] of phoneMap.entries()) {
          if (ids.length > 1) {
            duplicatesFound += ids.length - 1;
            // Mark as potential duplicates (don't auto-merge)
            for (let i = 1; i < ids.length; i++) {
              await supabase
                .from('clinics')
                .update({ is_duplicate: true, duplicate_group_id: ids[0] })
                .eq('id', ids[i]);
            }
          }
        }
        
        if (duplicatesFound > 0) {
          await supabase.from('platform_alerts').insert({
            alert_type: 'duplicate_detection',
            title: `${duplicatesFound} potential duplicate listings detected`,
            message: 'Please review and merge or dismiss these duplicates.',
            severity: 'warning',
          });
        }
        
        return {
          success: true,
          details: { duplicates_found: duplicatesFound },
        };
      }

      default:
        return {
          success: false,
          error: `Unknown rule type: ${rule.rule_type}`,
        };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
