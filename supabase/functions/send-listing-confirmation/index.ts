import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, generateListingConfirmationHTML } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ListingConfirmationRequest {
  clinicName: string;
  dentistName: string;
  email: string;
  phone: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clinicName, dentistName, email }: ListingConfirmationRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return new Response(JSON.stringify({ success: true, message: "Email skipped - no API key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const html = generateListingConfirmationHTML({
      clinicName,
      userName: dentistName,
      dashboardUrl: `${Deno.env.get("SITE_URL") || "https://www.appointpanda.com"}/dashboard`,
    });

    const subject = `Your Practice Listing Request Received`;
    const result = await sendEmail(resendApiKey, email, subject, html);

    await logEmail(supabase, {
      recipient: email,
      subject,
      type: "listing_confirmation",
      status: result.success ? "sent" : "failed",
      error_message: result.error,
      resend_id: result.id,
    });

    if (!result.success) {
      console.error("Confirmation email send failed:", result.error);
    } else {
      console.log("Confirmation email sent to:", email, "ID:", result.id);
    }

    return new Response(JSON.stringify({ success: result.success, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending confirmation email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
