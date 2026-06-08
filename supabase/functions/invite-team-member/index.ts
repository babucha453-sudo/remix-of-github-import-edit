import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { sendEmail, logEmail, generateTeamInviteHTML } from "../_shared/email.ts";

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
        const { data: inviter } = await supabaseAdmin.auth.admin.getUserById(invitedBy);
        const inviterName = inviter?.user?.user_metadata?.full_name || 'A team member';
        const html = generateTeamInviteHTML({
          clinicName: clinicName || 'a dental practice',
          inviteUrl: inviteLink,
          inviterName,
          role: role || 'team member',
        });
        const subject = `You've been invited to join ${clinicName || 'a dental practice'} on AppointPanda`;
        const result = await sendEmail(resendApiKey, email, subject, html);
        await logEmail(supabaseAdmin, {
          recipient: email,
          subject,
          type: "team_invite",
          status: result.success ? "sent" : "failed",
          error_message: result.error,
          resend_id: result.id,
        });
        if (!result.success) {
          console.error("Invite email send failed:", result.error);
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