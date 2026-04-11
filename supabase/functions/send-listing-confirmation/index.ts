import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBranding, wrapEmailContent, getFromAddress } from "../_shared/branding.ts";

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
    const { clinicName, dentistName, email, phone }: ListingConfirmationRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return new Response(JSON.stringify({ success: true, message: "Email skipped - no API key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get branding from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const branding = await getBranding(supabase);

    // Generate email body content
    const bodyContent = `
      <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">
        Dear ${dentistName},
      </h2>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Thank you for submitting your practice listing request for <strong>${clinicName}</strong>. We're excited to have you join ${branding.siteName}!
      </p>
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdfa; border: 2px solid #99f6e4; border-radius: 12px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 24px;">
            <h3 style="margin: 0 0 16px; color: #0d9488; font-size: 18px;">What happens next?</h3>
            <ol style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
              <li>Our team will review your submission within 24-48 hours</li>
              <li>We may contact you at <strong>${phone}</strong> for verification</li>
              <li>Once approved, you'll receive login credentials</li>
              <li>Your profile will go live and patients can start booking</li>
            </ol>
          </td>
        </tr>
      </table>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        If you have any questions, feel free to reply to this email or contact our support team.
      </p>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
        Best regards,<br>
        <strong>The ${branding.siteName} Team</strong>
      </p>
    `;

    const emailHtml = wrapEmailContent(branding, '🎉 Submission Received!', '🎉', bodyContent);

    // Use fetch to call Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getFromAddress(branding),
        to: [email],
        subject: `Your Practice Listing Request Received - ${branding.siteName}`,
        html: emailHtml,
      }),
    });

    const result = await emailResponse.json();
    console.log("Confirmation email sent:", result);

    return new Response(JSON.stringify({ success: true, data: result }), {
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
