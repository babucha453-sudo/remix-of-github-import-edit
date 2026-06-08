import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { sendEmail, logEmail, getEmailSettings, generateApprovalCredentialsHTML } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SignupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name required").max(200).trim(),
});

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

    // Send welcome email with Resend - no plaintext password
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const emailSettings = await getEmailSettings(supabaseAdmin);
        const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://appointpanda.com";
        // Generate a password reset link instead of including the raw password
        let resetLink = `${siteUrl}/auth?type=recovery`;
        try {
          const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: { redirectTo: `${siteUrl}/auth?type=recovery` },
          });
          if (linkData?.properties?.action_link) {
            resetLink = linkData.properties.action_link;
          }
        } catch (linkErr) {
          console.error("Failed to generate reset link, using fallback:", linkErr);
        }
        const html = generateApprovalCredentialsHTML({
          clinicName: fullName,
          userName: fullName,
          email,
          resetLink,
          loginUrl: `${siteUrl}/auth`,
        });
        const from = `${emailSettings.from_name} <${emailSettings.from_email}>`;
        const result = await sendEmail(resendApiKey, email, `Welcome to AppointPanda, ${fullName}!`, html, { from });
        await logEmail(supabaseAdmin, {
          recipient: email,
          subject: `Welcome to AppointPanda, ${fullName}!`,
          type: "welcome_approval",
          status: result.success ? "sent" : "failed",
          error_message: result.error,
          resend_id: result.id,
          user_id: newUser.user.id,
        });
        if (!result.success) {
          console.error("Welcome email send failed:", result.error);
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