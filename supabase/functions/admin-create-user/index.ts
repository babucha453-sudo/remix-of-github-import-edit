import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const CreateUserSchema = z.object({
  email: z.string().email("Invalid email format").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password too long"),
  fullName: z.string().min(1, "Full name required").max(200, "Full name too long").trim(),
  role: z.enum(["super_admin", "district_manager", "dentist", "patient"], {
    errorMap: () => ({ message: "Invalid role. Must be super_admin, district_manager, dentist, or patient" })
  }),
  clinicId: z.string().uuid("Invalid clinic ID format").optional(),
});

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
      return new Response(JSON.stringify({ error: "Only super admins can create users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate input
    const body = await req.json();
    const validationResult = CreateUserSchema.safeParse(body);
    
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

    const { email, password, fullName, role, clinicId } = validationResult.data;

    // Create user with admin client
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.user.id,
      role: role,
    });

    if (roleError) {
      console.error("Error assigning role:", roleError);
    }

    // If dentist and clinic provided, link to clinic
    if (role === "dentist" && clinicId) {
      // Create a dentist record linked to the clinic with unique slug
      const baseSlug = fullName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
      
      const { data: existingSlugs } = await supabaseAdmin
        .from('dentists')
        .select('slug')
        .like('slug', `${baseSlug}%`);
      
      let dentistSlug = baseSlug;
      if (existingSlugs && existingSlugs.length > 0) {
        const exactMatch = existingSlugs.some((row: any) => row.slug === baseSlug);
        if (exactMatch) {
          let counter = 2;
          while (existingSlugs.some((row: any) => row.slug === `${baseSlug}-${counter}`)) {
            counter++;
          }
          dentistSlug = `${baseSlug}-${counter}`;
        }
      }
      
      await supabaseAdmin.from("dentists").insert({
        name: fullName,
        slug: dentistSlug,
        email: email,
        clinic_id: clinicId,
        is_active: true,
      });

      // Update clinic claimed_by
      await supabaseAdmin.from("clinics").update({
        claimed_by: newUser.user.id,
        claim_status: "claimed",
        claimed_at: new Date().toISOString(),
      }).eq("id", clinicId);
    }

    console.log("User created successfully:", newUser.user.id);

    // Send welcome email with Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && newUser.user.email) {
      try {
        const welcomeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0097b2,#00c5cc);padding:40px;text-align:center;">
      <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;">Appoint<span style="color:#ffd700;">Panda</span></h1>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a2e;">Welcome, ${fullName}!</h2>
      <p style="margin:0 0 24px;color:#666;line-height:1.6;">Your AppointPanda account has been created. Sign in below to manage your dental practice.</p>
      <div style="background:#f4f7fb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;">Email</p>
        <p style="margin:0 0 4px;font-size:14px;color:#333;"><strong>${email}</strong></p>
        <p style="margin:0 0 4px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;">Password</p>
        <p style="margin:0;font-size:14px;color:#333;"><strong>${password}</strong></p>
      </div>
      <p style="margin:0 0 20px;font-size:13px;color:#888;">Please change your password after your first login.</p>
      <a href="${Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://appointpanda.com"}/auth" style="display:inline-block;background:linear-gradient(135deg,#0097b2,#00c5cc);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">Sign In to AppointPanda</a>
      <p style="margin:28px 0 0;font-size:12px;color:#aaa;text-align:center;">© ${new Date().getFullYear()} AppointPanda</p>
    </div>
  </div>
</body>
</html>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "AppointPanda <noreply@appointpanda.com>",
            to: newUser.user.email,
            subject: `Welcome to AppointPanda, ${fullName}!`,
            html: welcomeHtml,
          }),
        });
        console.log("Welcome email sent to:", newUser.user.email);
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured or no email - skipping welcome email");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId: newUser.user.id,
      message: `User ${email} created with role ${role}` 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in admin-create-user:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
