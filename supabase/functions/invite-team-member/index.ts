import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const InviteSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required").max(200),
  clinicId: z.string().uuid("Invalid clinic ID"),
  role: z.string().optional(),
  invitedBy: z.string().uuid("Invalid user ID"),
  clinicName: z.string().optional(),
});

function generateInviteEmail(inviterName: string, clinicName: string, inviteLink: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to join a team</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0097b2,#00c5cc);padding:40px 40px 30px;text-align:center;">
      <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;">Appoint<span style="color:#ffd700;">Panda</span></h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Dental Practice Dashboard</p>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">You've been invited!</h2>
      <p style="margin:0 0 24px;color:#666;line-height:1.6;">
        ${inviterName} has invited you to join <strong>${clinicName || 'their dental practice'}</strong> on AppointPanda.
      </p>

      <div style="background:#f4f7fb;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your Invitation</p>
        <p style="margin:0;font-size:14px;color:#555;"><strong>${clinicName || 'Dental Practice'}</strong></p>
      </div>

      <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#0097b2,#00c5cc);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 4px 16px rgba(0,151,178,0.35);">Accept Invitation</a>

      <p style="margin:24px 0 0;font-size:12px;color:#aaa;text-align:center;">
        This invitation link will expire in 7 days.<br/>
        If you don't have an AppointPanda account, you'll be prompted to create one.
      </p>

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
    const validationResult = InviteSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, name, clinicId, role, invitedBy, clinicName } = validationResult.data;

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users.some(u => u.email?.toLowerCase() === email.toLowerCase());

    // Generate secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Store invite token in clinic_team_invites table
    const { error: inviteError } = await supabaseAdmin.from("clinic_team_invites").insert({
      clinic_id: clinicId,
      email: email.toLowerCase(),
      invite_token: token,
      invited_by: invitedBy,
      expires_at: expiresAt,
      status: 'pending',
    });

    if (inviteError) {
      console.error("Error storing invite:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send invite email
    const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://appointpanda.com";
    const inviteLink = `${siteUrl}/team-invite/${token}`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        // Get inviter name
        const { data: inviter } = await supabaseAdmin.auth.admin.getUserById(invitedBy);
        const inviterName = inviter?.user?.user_metadata?.full_name || 'A team member';
        const emailHtml = generateInviteEmail(inviterName, clinicName || '', inviteLink);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AppointPanda <noreply@appointpanda.com>",
            to: email,
            subject: `You've been invited to join ${clinicName || 'a dental practice'} on AppointPanda`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errBody = await emailResponse.text();
          console.error("Resend error:", emailResponse.status, errBody);
        } else {
          console.log("Invite email sent to:", email);
        }
      } catch (emailError) {
        console.error("Failed to send invite email:", emailError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured, invite link:", inviteLink);
    }

    return new Response(
      JSON.stringify({
        success: true,
        inviteLink: userExists ? inviteLink : null,
        message: userExists
          ? "Invitation sent. They will receive an email to accept."
          : "Invitation sent. They will receive an email to create an account and join."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in invite-team-member:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});