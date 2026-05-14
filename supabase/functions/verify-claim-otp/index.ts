import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const VerifyOTPSchema = z.object({
  clinicId: z.string().uuid("Invalid clinic ID format"),
  code: z.string()
    .length(6, "Verification code must be 6 digits")
    .regex(/^\d{6}$/, "Verification code must contain only digits"),
});

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
    const validationResult = VerifyOTPSchema.safeParse(body);
    
    if (!validationResult.success) {
      // Log detailed errors server-side only
      console.error("Validation error:", validationResult.error.issues);
      return new Response(JSON.stringify({ 
        error: "Invalid request. Please check your input and try again."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clinicId, code } = validationResult.data;

    // Get claim request
    const { data: claimRequest, error: claimError } = await supabaseClient
      .from("claim_requests")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single();

    if (claimError || !claimRequest) {
      return new Response(JSON.stringify({ error: "No pending claim request found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(claimRequest.verification_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Verification code has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check attempts
    if (claimRequest.verification_attempts >= 5) {
      return new Response(JSON.stringify({ error: "Too many attempts. Please request a new code." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment attempts
    await supabaseClient
      .from("claim_requests")
      .update({ verification_attempts: (claimRequest.verification_attempts || 0) + 1 })
      .eq("id", claimRequest.id);

    // Verify code
    if (claimRequest.verification_code !== code) {
      return new Response(JSON.stringify({ error: "Invalid verification code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success! Update claim request and clinic
    await supabaseClient
      .from("claim_requests")
      .update({ status: "approved" })
      .eq("id", claimRequest.id);

    await supabaseClient
      .from("clinics")
      .update({
        claim_status: "claimed",
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", clinicId);

    // Add dentist role if not exists
    const { data: existingRole } = await supabaseClient
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "dentist")
      .single();

    if (!existingRole) {
      await supabaseClient.from("user_roles").insert({
        user_id: user.id,
        role: "dentist",
      });
    }

    // Send welcome email after successful claim
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const { data: clinicData } = await supabaseClient
        .from("clinics")
        .select("name, email, slug")
        .eq("id", clinicId)
        .single();

      if (clinicData) {
        const welcomeHtml = `
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
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Welcome to Appoint Panda!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px; text-align: center;">
                  <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 22px;">Congratulations, ${clinicData.name}!</h2>
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                    Your profile has been successfully verified and claimed. You now have access to:
                  </p>
                  <ul style="text-align: left; color: #475569; font-size: 15px; line-height: 2;">
                    <li>Update your clinic information</li>
                    <li>Manage patient appointments</li>
                    <li>View and respond to patient reviews</li>
                    <li>Track leads and conversions</li>
                    <li>Access analytics dashboard</li>
                  </ul>
                  <div style="margin: 30px 0;">
                    <a href="https://www.appointpanda.com/dashboard?tab=my-dashboard" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                      Go to Dashboard
                    </a>
                  </div>
                  <p style="margin: 20px 0; color: #6b7280; font-size: 14px;">
                    Need help getting started? Check out our onboarding guide or contact support.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 40px; background-color: #f4f4f5; text-align: center;">
                  <p style="margin: 0; color: #6b7280; font-size: 12px;">
                    © ${new Date().getFullYear()} Appoint Panda. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        const userEmail = user.email;
        if (userEmail) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Appoint Panda <no-reply@appointpanda.com>",
              to: [userEmail],
              subject: `Welcome! Your profile for ${clinicData.name} is now live`,
              html: welcomeHtml,
            }),
          });
          console.log("Welcome email sent to:", userEmail);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Profile claimed successfully!" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in verify-claim-otp:", error);
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
