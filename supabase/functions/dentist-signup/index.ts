import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SignupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name required").max(200).trim(),
});

function generateEmailTemplate(fullName: string, email: string, tempPassword: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AppointPanda</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0097b2,#00c5cc);padding:40px 40px 30px;text-align:center;">
      <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;">Appoint<span style="color:#ffd700;">Panda</span></h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Your dental practice dashboard</p>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">Welcome, ${fullName}!</h2>
      <p style="margin:0 0 24px;color:#666;line-height:1.6;">Your AppointPanda account has been created. You can now sign in with your credentials below.</p>

      <div style="background:#f4f7fb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your Login Details</p>
        <p style="margin:0 0 4px;font-size:13px;color:#555;"><strong>Email:</strong> ${email}</p>
        <p style="margin:0;font-size:13px;color:#555;"><strong>Password:</strong> ${tempPassword}</p>
      </div>

      <p style="margin:0 0 24px;font-size:13px;color:#888;line-height:1.5;">For security, we recommend changing your password after your first login.</p>

      <a href="${Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://appointpanda.com"}/auth" style="display:inline-block;background:linear-gradient(135deg,#0097b2,#00c5cc);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 4px 16px rgba(0,151,178,0.35);">Sign In to AppointPanda</a>

      <p style="margin:28px 0 0;font-size:12px;color:#aaa;text-align:center;">© ${new Date().getFullYear()} AppointPanda. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const validationResult = SignupSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, fullName } = validationResult.data;

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    if (existingUser?.users.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: "This email is already registered. Please sign in." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user with admin API (bypasses email rate limits since email is pre-confirmed)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        signup_source: "dentist_signup_page",
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      const errMsg = createError.message.toLowerCase();
      if (errMsg.includes("already exists") || errMsg.includes("user already")) {
        return new Response(
          JSON.stringify({ error: "This email is already registered. Please sign in." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign dentist role
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.user.id,
      role: "dentist",
    });

    // Create dentists record
    const { error: dentistError } = await supabaseAdmin.from("dentists").upsert({
      user_id: newUser.user.id,
      full_name: fullName,
      email: email,
      onboarding_completed: false,
      onboarding_step: 1,
    }, { onConflict: 'user_id' });

    if (dentistError) {
      console.error("Error creating dentists record:", dentistError);
    } else {
      console.log("Dentists record created for user:", newUser.user.id);
    }

    // Send welcome email with Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const emailHtml = generateEmailTemplate(fullName, email, password);
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AppointPanda <noreply@appointpanda.com>",
            to: email,
            subject: `Welcome to AppointPanda, ${fullName}!`,
            html: emailHtml,
          }),
        });
        if (!emailResponse.ok) {
          const errBody = await emailResponse.text();
          console.error("Resend error:", emailResponse.status, errBody);
        } else {
          console.log("Welcome email sent to:", email);
        }
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping welcome email");
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in dentist-signup:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});