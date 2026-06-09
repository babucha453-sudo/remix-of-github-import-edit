import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, getEmailSettings } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendFormRequest {
  submissionId: string;
  templateName: string;
  deliveryMethod: "email" | "sms";
  patientEmail?: string;
  patientPhone?: string;
  patientName?: string;
  customMessage?: string;
  clinicName: string;
}

function generateFormEmailHTML(
  clinicName: string,
  templateName: string,
  patientName: string | undefined,
  customMessage: string | undefined,
  formUrl: string,
  supportEmail: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Please Complete Your Form</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">${clinicName}</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">Form Request</div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">
                ${patientName ? `Hello ${patientName},` : 'Hello,'}
              </h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                ${clinicName} has requested that you complete the following form before your visit:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f9ff; border: 2px solid #bae6fd; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="color: #0284C7; font-size: 18px; font-weight: 600; margin: 0;">${templateName}</p>
                  </td>
                </tr>
              </table>
              ${customMessage ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5; font-style: italic;">"${customMessage}"</p>
                  </td>
                </tr>
              </table>
              ` : ''}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${formUrl}" style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Complete Form Now</a>
                  </td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 14px; margin: 0 0 16px 0; text-align: center;">Or copy and paste this link into your browser:</p>
              <p style="color: #0284C7; font-size: 13px; margin: 0; text-align: center; word-break: break-all;">
                <a href="${formUrl}" style="color: #0284C7;">${formUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 28px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">This is an automated message from ${clinicName}</p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px 0;">Need help? <a href="mailto:${supportEmail}" style="color: #14b8a6; text-decoration: none;">${supportEmail}</a></p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} AppointPanda. All rights reserved</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: SendFormRequest = await req.json();
    const { submissionId, templateName, deliveryMethod, patientEmail, patientPhone, patientName, customMessage, clinicName } = body;

    const baseUrl = `https://www.appointpanda.com/form/${submissionId}`;
    const { data: submissionRow } = await supabase
      .from('patient_form_submissions')
      .select('access_token')
      .eq('id', submissionId)
      .maybeSingle();

    const accessToken = submissionRow?.access_token as string | null | undefined;
    const formUrl = accessToken ? `${baseUrl}?token=${encodeURIComponent(accessToken)}` : baseUrl;

    if (deliveryMethod === "email" && patientEmail) {
      if (!resendApiKey) {
        return new Response(
          JSON.stringify({ error: "Email service not configured (RESEND_API_KEY missing)", formUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const emailSettings = await getEmailSettings(supabase);
      const emailHtml = generateFormEmailHTML(clinicName, templateName, patientName, customMessage, formUrl, emailSettings.support_email);
      const subject = `Please Complete: ${templateName} - ${clinicName}`;
      const from = `${emailSettings.from_name} <${emailSettings.from_email}>`;
      const result = await sendEmail(resendApiKey, patientEmail, subject, emailHtml, { from });

      await logEmail(supabase, {
        recipient: patientEmail,
        subject,
        type: 'form_request',
        status: result.success ? 'sent' : 'failed',
        error_message: result.error,
        resend_id: result.id,
      });

      if (!result.success) {
        return new Response(
          JSON.stringify({ error: result.error, formUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    } else if (deliveryMethod === "sms" && patientPhone) {
      console.log("SMS would be sent to:", patientPhone, "Form URL:", formUrl);
    }

    await supabase
      .from("patient_form_submissions")
      .update({ status: "pending" })
      .eq("id", submissionId);

    return new Response(
      JSON.stringify({ success: true, formUrl, message: `Form request sent via ${deliveryMethod}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
