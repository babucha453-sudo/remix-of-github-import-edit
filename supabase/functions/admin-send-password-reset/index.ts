import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getBranding, wrapEmailContent, getFromAddress } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dynamic import for Resend
const getResendClient = async () => {
  const { Resend } = await import("https://esm.sh/resend@2.0.0");
  return new Resend(Deno.env.get("RESEND_API_KEY"));
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is super_admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = callerRoles?.some(r => r.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Only super admins can send password resets" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the email from request body
    const { email } = await req.json();
    
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get branding from database
    const branding = await getBranding(supabaseAdmin);
    const siteUrl = branding.siteUrl;

    // Generate password reset link using admin client
    const { data: linkData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${siteUrl}/auth?type=recovery`,
      },
    });

    if (resetError) {
      console.error("Error generating password reset link:", resetError);
      
      // Check if it's a rate limit error
      const isRateLimit = resetError.message?.includes('security purposes') || 
                          resetError.message?.includes('rate limit') ||
                          (resetError as any).code === 'over_email_send_rate_limit';
      
      return new Response(JSON.stringify({ 
        error: isRateLimit 
          ? "Please wait at least 60 seconds before sending another password reset to this user." 
          : resetError.message 
      }), {
        status: isRateLimit ? 429 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = linkData?.properties?.action_link;
    
    if (!resetLink) {
      console.error("No reset link generated");
      return new Response(JSON.stringify({ error: "Failed to generate reset link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate email body content
    const bodyContent = `
      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #0f172a;">
        Reset Your Password
      </h2>
      
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #475569;">
        We received a request to reset your password for your ${branding.siteName} account. Click the button below to create a new password.
      </p>
      
      <!-- CTA Button -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
        <tr>
          <td style="border-radius: 12px; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);">
            <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 12px;">
              Reset My Password
            </a>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #64748b;">
        This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
      </p>
      
      <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: #64748b;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      
      <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #94a3b8; word-break: break-all;">
        ${resetLink}
      </p>
    `;

    const emailHtml = wrapEmailContent(branding, 'Reset Your Password', '🔐', bodyContent);

    // Send professional email using Resend
    const resend = await getResendClient();
    const emailResponse = await resend.emails.send({
      from: getFromAddress(branding),
      to: [email],
      subject: `Reset Your Password - ${branding.siteName}`,
      html: emailHtml,
    });

    if (emailResponse.error) {
      console.error("Error sending email via Resend:", emailResponse.error);
      return new Response(JSON.stringify({ 
        error: `Failed to send email: ${emailResponse.error.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      user_id: caller.id,
      action: 'SEND_PASSWORD_RESET',
      entity_type: 'user',
      new_values: { email, resend_id: emailResponse.data?.id },
    });

    console.log("Password reset email sent successfully to:", email, "Resend ID:", emailResponse.data?.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Password reset email sent to ${email}` 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in admin-send-password-reset:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});