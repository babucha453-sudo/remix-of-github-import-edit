import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailSettings {
  from_email: string;
  from_name: string;
}

interface LeadData {
  patient_name: string;
  patient_email: string | null;
  patient_phone: string;
  message: string | null;
  clinic_name: string;
  clinic_email: string | null;
  clinic_phone: string | null;
  source: string;
  created_at: string;
}

async function getEmailSettings(supabase: any): Promise<EmailSettings> {
  const { data } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "email")
    .single();

  if (data?.value) {
    const settings = data.value as unknown as EmailSettings;
    return settings;
  }

  return {
    from_email: "no-reply@appointpanda.com",
    from_name: "Appoint Panda",
  };
}

async function sendEmailViaResend(
  resendApiKey: string,
  settings: EmailSettings,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanHtml = html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\r\n/g, "")
      .replace(/\r/g, "")
      .replace(/\n/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/>\s+</g, "><")
      .trim();

    const fromName = (settings.from_name || "Appoint Panda").trim() || "Appoint Panda";
    const fromEmail = (settings.from_email || "").trim() || "no-reply@appointpanda.com";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: cleanHtml,
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    const bodyText = await response.text();
    return { success: false, error: `Resend API error (${response.status}): ${bodyText}` };
  } catch (error: any) {
    console.error("Resend send error:", error);
    return { success: false, error: error.message };
  }
}

function generateLeadEmailHTML(lead: LeadData, siteUrl: string): string {
  const clinicContact = [lead.clinic_phone, lead.clinic_email]
    .filter(Boolean)
    .join(" | ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead Received</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">New Lead Received</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">📬 You have a new patient inquiry</div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 22px; font-weight: 600;">
                Hello ${lead.clinic_name},
              </h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                A new patient has submitted a lead request for your clinic. Here's the details:
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdfa; border: 2px solid #99f6e4; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td colspan="2" style="padding-bottom: 16px; border-bottom: 1px solid #99f6e4;">
                          <span style="color: #0d9488; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Lead Details</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 0 0 0; color: #64748b; font-size: 14px; width: 100px;">Name</td>
                        <td style="padding: 14px 0 0 0; color: #1e293b; font-size: 15px; font-weight: 600;">${lead.patient_name}</td>
                      </tr>
                      ${lead.patient_email ? `
                      <tr>
                        <td style="padding: 10px 0 0 0; color: #64748b; font-size: 14px;">Email</td>
                        <td style="padding: 10px 0 0 0; color: #1e293b; font-size: 15px;"><a href="mailto:${lead.patient_email}" style="color:#0d9488; text-decoration:none;">${lead.patient_email}</a></td>
                      </tr>
                      ` : ""}
                      ${lead.patient_phone ? `
                      <tr>
                        <td style="padding: 10px 0 0 0; color: #64748b; font-size: 14px;">Phone</td>
                        <td style="padding: 10px 0 0 0; color: #1e293b; font-size: 15px;"><a href="tel:${lead.patient_phone}" style="color:#0d9488; text-decoration:none;">${lead.patient_phone}</a></td>
                      </tr>
                      ` : ""}
                      ${lead.message ? `
                      <tr>
                        <td style="padding: 10px 0 0 0; color: #64748b; font-size: 14px; vertical-align: top;">Message</td>
                        <td style="padding: 10px 0 0 0; color: #1e293b; font-size: 15px;">${lead.message}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="padding: 10px 0 0 0; color: #64748b; font-size: 14px;">Source</td>
                        <td style="padding: 10px 0 0 0; color: #1e293b; font-size: 15px;">${lead.source || "Website"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0 0 0; color: #64748b; font-size: 14px;">Received</td>
                        <td style="padding: 10px 0 0 0; color: #1e293b; font-size: 15px;">${new Date(lead.created_at).toLocaleString()}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${siteUrl}/dashboard?tab=leads" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      View All Leads
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                      <strong>💡 Tip:</strong> Respond to leads within 24 hours to increase your conversion rate by up to 50%!
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 28px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">
                ${lead.clinic_name}
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} Appoint Panda. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        clinic:clinics(id, name, email, phone, slug)
      `)
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clinic = lead.clinic;
    if (!clinic?.email) {
      return new Response(
        JSON.stringify({ error: "Clinic has no email configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailSettings = await getEmailSettings(supabaseClient);
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.appointpanda.com";

    const leadData: LeadData = {
      patient_name: lead.patient_name,
      patient_email: lead.patient_email,
      patient_phone: lead.patient_phone,
      message: lead.message,
      clinic_name: clinic.name,
      clinic_email: clinic.email,
      clinic_phone: clinic.phone,
      source: lead.source,
      created_at: lead.created_at,
    };

    const html = generateLeadEmailHTML(leadData, siteUrl);
    const subject = `New Lead: ${lead.patient_name} - ${clinic.name}`;

    const result = await sendEmailViaResend(
      resendApiKey,
      emailSettings,
      clinic.email,
      subject,
      html
    );

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, message: "Lead email sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Error in lead-email-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);