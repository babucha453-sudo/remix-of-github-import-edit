import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const SendOTPSchema = z.object({
  clinicId: z.string().uuid("Invalid clinic ID format"),
  method: z.enum(["email", "phone"], { errorMap: () => ({ message: "Method must be 'email' or 'phone'" }) }),
  email: z.string().email("Invalid email format").max(255, "Email too long").optional(),
  businessEmail: z.string().email("Invalid business email format").max(255, "Email too long").optional(),
  businessPhone: z.string().max(30, "Phone too long").optional(),
});

interface SMTPSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

async function getSmtpSettings(supabaseClient: any): Promise<SMTPSettings | null> {
  const { data: settings } = await supabaseClient
    .from('global_settings')
    .select('key, value')
    .eq('key', 'smtp')
    .single();

  if (!settings || !settings.value) return null;

  const smtp = settings.value as Record<string, any>;

  if (!smtp.host || !smtp.username || !smtp.password) {
    return null;
  }

  return {
    host: smtp.host,
    port: parseInt(smtp.port?.toString() || '587'),
    user: smtp.username,
    pass: smtp.password,
    from: smtp.from_email ? `${smtp.from_name || 'Appoint Panda'} <${smtp.from_email}>` : 'Appoint Panda <no-reply@appointpanda.com>',
    secure: smtp.port === 465,
  };
}

async function sendEmailViaSMTP(
  settings: SMTPSettings,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: settings.host,
        port: settings.port,
        tls: settings.secure,
        auth: {
          username: settings.user,
          password: settings.pass,
        },
      },
    });

    await client.send({
      from: settings.from,
      to: to,
      subject: subject,
      content: "auto",
      html: html,
    });

    await client.close();
    return { success: true };
  } catch (error: any) {
    console.error("SMTP error:", error);
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

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate input
    const body = await req.json();
    const validationResult = SendOTPSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.issues);
      return new Response(JSON.stringify({ 
        error: "Invalid request. Please check your input and try again."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clinicId, method, email, businessEmail, businessPhone } = validationResult.data;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Get clinic info
    const { data: clinic } = await supabaseClient
      .from("clinics")
      .select("name, email")
      .eq("id", clinicId)
      .single();

    if (!clinic) {
      return new Response(JSON.stringify({ error: "Clinic not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use businessEmail if provided, else email, else clinic.email
    const targetVerificationEmail = businessEmail || email || clinic.email;
    
    // Create or update claim request with OTP
    const { error: upsertError } = await supabaseClient
      .from("claim_requests")
      .upsert({
        clinic_id: clinicId,
        user_id: user.id,
        verification_code: otp,
        verification_expires_at: expiresAt.toISOString(),
        verification_method: method,
        verification_sent_at: new Date().toISOString(),
        verification_attempts: 0,
        status: "pending",
        business_email: targetVerificationEmail,
        requester_phone: businessPhone || null,
      }, {
        onConflict: "clinic_id,user_id",
      });

    if (upsertError) {
      console.error("Error storing OTP:", upsertError);
      // Try insert instead
      await supabaseClient.from("claim_requests").insert({
        clinic_id: clinicId,
        user_id: user.id,
        verification_code: otp,
        verification_expires_at: expiresAt.toISOString(),
        verification_method: method,
        verification_sent_at: new Date().toISOString(),
        verification_attempts: 0,
        status: "pending",
        business_email: targetVerificationEmail,
        requester_phone: businessPhone || null,
      });
    }

    const emailToSend = targetVerificationEmail || user.email;
    
    if (!emailToSend) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "No email address available for verification."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Verification Code</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px; text-align: center;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                Your verification code to claim <strong>${clinic.name}</strong> is:
              </p>
              <div style="background-color: #f0fdfa; border-radius: 12px; padding: 24px; margin: 20px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0d9488;">${otp}</span>
              </div>
              <p style="margin: 20px 0; color: #6b7280; font-size: 14px;">
                This code expires in 10 minutes.
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f4f4f5; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                © 2024 Appoint Panda. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Try SMTP first
    const smtpSettings = await getSmtpSettings(supabaseClient);
    
    if (smtpSettings) {
      const smtpResult = await sendEmailViaSMTP(
        smtpSettings,
        emailToSend,
        `Your Verification Code: ${otp} - Appoint Panda`,
        emailHtml
      );

      if (smtpResult.success) {
        console.log("OTP email sent via SMTP to:", emailToSend);
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Verification code sent to ${method}`
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        console.error("SMTP failed:", smtpResult.error);
      }
    }

    // Fallback to Resend if SMTP not configured or failed
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Appoint Panda <no-reply@appointpanda.com>",
          to: [emailToSend],
          subject: `Your Verification Code: ${otp} - Appoint Panda`,
          html: emailHtml,
        }),
      });

      const result = await emailResponse.json();
      console.log("OTP email sent via Resend to:", emailToSend, result);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Verification code sent to ${method}`
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No email service configured
    console.log("OTP generated but no email service configured - OTP stored in database only");
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Email service not configured. Please configure SMTP settings in admin or contact support."
    }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in send-claim-otp:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
