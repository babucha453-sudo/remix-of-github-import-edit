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

async function sendWebhook(webhookUrl: string, leadData: LeadData): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Sending lead data to n8n webhook:", webhookUrl);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "new_lead",
        source: "appointpanda",
        timestamp: new Date().toISOString(),
        lead: {
          id: leadData.id,
          clinic_id: leadData.clinic_id,
          patient_name: leadData.patient_name,
          patient_email: leadData.patient_email,
          patient_phone: leadData.patient_phone,
          message: leadData.message,
          source: leadData.source,
          status: leadData.status,
          created_at: leadData.created_at,
        },
        clinic: {
          name: leadData.clinic_name,
          phone: leadData.clinic_phone,
          email: leadData.clinic_email,
        },
      }),
    });

    const responseText = await response.text();
    console.log("n8n webhook response:", response.status, responseText);

    if (response.ok) {
      return { success: true };
    }

    return { success: false, error: `Webhook returned ${response.status}: ${responseText}` };
  } catch (error: any) {
    console.error("Error sending to n8n webhook:", error);
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
    const { lead_id, clinic_id, patient_name, patient_email, patient_phone, message, source } = body;

    if (!patient_name || !patient_phone) {
      return new Response(
        JSON.stringify({ error: "patient_name and patient_phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let leadData: LeadData = {
      id: lead_id || "",
      clinic_id: clinic_id || null,
      patient_name,
      patient_email: patient_email || null,
      patient_phone,
      message: message || null,
      source: source || "website",
      status: "new",
      created_at: new Date().toISOString(),
    };

    if (clinic_id) {
      const { data: clinic } = await supabaseClient
        .from("clinics")
        .select("name, phone, email")
        .eq("id", clinic_id)
        .single();

      if (clinic) {
        leadData.clinic_name = clinic.name;
        leadData.clinic_phone = clinic.phone;
        leadData.clinic_email = clinic.email;
      }
    }

    const result = await sendWebhook(N8N_WEBHOOK_URL, leadData);

    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.success ? "Webhook sent" : "Webhook failed",
        error: result.error,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in lead-notification-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);