import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, getEmailSettings } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, email, changeType } = await req.json();
    if (!userId || !email || !changeType) {
      return new Response(JSON.stringify({ error: "userId, email, and changeType required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailSettings = await getEmailSettings(supabase);
    const from = `${emailSettings.from_name} <${emailSettings.from_email}>`;

    let subject: string;
    let bodyHtml: string;

    if (changeType === "password") {
      subject = "Your AppointPanda Password Has Been Changed";
      bodyHtml = `
        <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 22px; font-weight: 600;">Password Changed</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
          Your AppointPanda account password was successfully changed.
        </p>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          If you made this change, no further action is needed.
        </p>
        <p style="color: #ef4444; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong>⚠️ Didn't request this?</strong> Contact support immediately at <a href="mailto:support@appointpanda.com" style="color: #0d9488;">support@appointpanda.com</a>
        </p>`;
    } else if (changeType === "email") {
      subject = "Your AppointPanda Email Address Has Been Changed";
      bodyHtml = `
        <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 22px; font-weight: 600;">Email Address Changed</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
          Your AppointPanda account email address was successfully changed to <strong>${email}</strong>.
        </p>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          If you made this change, no further action is needed.
        </p>
        <p style="color: #ef4444; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong>⚠️ Didn't request this?</strong> Contact support immediately at <a href="mailto:support@appointpanda.com" style="color: #0d9488;">support@appointpanda.com</a>
        </p>`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid changeType. Must be 'password' or 'email'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendEmail(resendApiKey, email, subject, bodyHtml, { from });
    await logEmail(supabase, {
      recipient: email,
      subject,
      type: `${changeType}_change_notification`,
      status: result.success ? "sent" : "failed",
      error_message: result.error,
      resend_id: result.id,
      user_id: userId,
    });

    return new Response(JSON.stringify({ success: result.success }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-password-change error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
