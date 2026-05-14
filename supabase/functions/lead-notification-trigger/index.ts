import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_WEBHOOK_URL = Deno.env.get("N8N_LEAD_WEBHOOK_URL") ||
  "https://auton8n.n8n.shivahost.in/webhook/5d50a6bb-3456-4c9c-a1e6-38d6371f1be6";

interface LeadData {
  id: string;
  clinic_id: string | null;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string;
  message: string | null;
  source: string;
  status: string;
  created_at: string;
  clinic_name?: string;
  clinic_phone?: string;
  clinic_email?: string;
}

async function triggerN8NWebhook(leadData: LeadData): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Triggering n8n webhook for lead:", leadData.id);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "lead_created",
        timestamp: new Date().toISOString(),
        data: {
          lead_id: leadData.id,
          clinic_id: leadData.clinic_id,
          patient_name: leadData.patient_name,
          patient_email: leadData.patient_email,
          patient_phone: leadData.patient_phone,
          message: leadData.message,
          source: leadData.source,
          clinic_name: leadData.clinic_name,
          clinic_phone: leadData.clinic_phone,
          clinic_email: leadData.clinic_email,
        },
      }),
    });

    if (response.ok) {
      console.log("n8n webhook triggered successfully for lead:", leadData.id);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error("n8n webhook failed:", response.status, errorText);
      return { success: false, error: `Webhook returned ${response.status}` };
    }
  } catch (error: any) {
    console.error("Error triggering n8n webhook:", error);
    return { success: false, error: error.message };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) {
      return new Response(
        JSON.stringify({ error: "lead_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lead, error: leadError } = await supabaseClient
      .from("clinic_lead_requests")
      .select(`
        *,
        clinic:clinics(id, name, phone, email)
      `)
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leadData: LeadData = {
      id: lead.id,
      clinic_id: lead.clinic_id,
      patient_name: lead.patient_name,
      patient_email: lead.patient_email,
      patient_phone: lead.patient_phone,
      message: lead.message,
      source: lead.source,
      status: lead.status,
      created_at: lead.created_at,
      clinic_name: lead.clinic?.name,
      clinic_phone: lead.clinic?.phone,
      clinic_email: lead.clinic?.email,
    };

    const result = await triggerN8NWebhook(leadData);

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, message: "Lead notification sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Error in lead-notification-trigger:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);