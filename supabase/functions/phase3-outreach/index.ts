import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// PHASE 3 OUTREACH SYSTEM
// Automated dentist partnership email campaigns
// ============================================================

interface OutreachRequest {
  action: "create-campaign" | "send-batch" | "get-stats" | "pause" | "resume";
  emailType?: "claim" | "followup" | "final";
  campaignId?: string;
  targetFilter?: {
    claim_status?: string;
    has_email?: boolean;
    state?: string;
  };
  batchSize?: number;
}

// Email templates
const EMAIL_TEMPLATES = {
  claim: {
    subject: "You're Listed on AppointPanda - Claim Your Free Profile",
    body: `Hi Dr. {{last_name}},

I'm reaching out because {{practice_name}} is currently listed on AppointPanda with basic information, but you haven't claimed your profile yet.

When you claim and complete your profile (takes 5 minutes), you'll receive:

✓ Do-follow backlink to your website (boosts SEO)
✓ Enhanced listing with photos, services, hours
✓ Patient review management tools
✓ Online appointment booking
✓ Priority placement in local searches

Your profile: {{profile_url}}

Claim it here: {{claim_url}}

Best,
The AppointPanda Team

---
AppointPanda - Connecting Patients with Great Dentists
Unsubscribe: {{unsubscribe_url}}`,
  },
  followup: {
    subject: "{{practice_name}} - Get More Patients From AppointPanda",
    body: `Dr. {{last_name}},

I wanted to follow up about your AppointPanda profile.

Last month, {{monthly_searches}} patients in {{city}} used AppointPanda to find dentists for dental care.

Here's what dentists with claimed profiles get:
- 5x more profile views
- Direct appointment requests
- Patient reviews & testimonials
- Backlink to boost your Google ranking

Complete your profile: {{claim_url}}

Takes 5 minutes, no credit card needed.

Best,
The AppointPanda Team

---
Unsubscribe: {{unsubscribe_url}}`,
  },
  final: {
    subject: "Final reminder: Claim your AppointPanda profile",
    body: `Dr. {{last_name}},

This is my final reminder about claiming your free AppointPanda profile for {{practice_name}}.

Your profile is currently showing basic information only. Claimed profiles receive:

✓ 5x more visibility in search results
✓ Direct patient booking requests
✓ Free SEO backlink to your website
✓ Review management tools

Claim your profile now: {{claim_url}}

If you have questions, just reply to this email.

Best,
The AppointPanda Team

---
Unsubscribe: {{unsubscribe_url}}`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isAdmin = (roles ?? []).some((r: any) =>
      ["super_admin", "district_manager"].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: OutreachRequest = await req.json();
    const { action, emailType = "claim", campaignId, targetFilter, batchSize = 50 } = body;

    console.log(`Phase 3 Outreach: ${action}`, { emailType, campaignId, targetFilter });

    switch (action) {
      case "create-campaign": {
        // Get target clinics
        let query = supabaseAdmin
          .from("clinics")
          .select("id, name, email, city, state")
          .eq("claim_status", targetFilter?.claim_status || "unclaimed")
          .not("email", "is", null);

        if (targetFilter?.state) {
          query = query.eq("state", targetFilter.state);
        }

        const { data: clinics, count } = await query;

        if (!clinics || clinics.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: "No matching clinics found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create campaign
        const campaignName = `${emailType === "claim" ? "Initial Claim" : emailType === "followup" ? "Follow-up" : "Final Reminder"} - ${new Date().toLocaleDateString()}`;

        const { data: campaign, error: campaignError } = await supabaseAdmin
          .from("outreach_campaigns")
          .insert({
            name: campaignName,
            description: `Phase 3 dentist partnership ${emailType} campaign`,
            target_filter: targetFilter,
            is_active: true,
            max_sends_per_day: 100,
            max_sends_per_clinic: 3,
            stats: { queued: clinics.length, sent: 0, opened: 0, clicked: 0, claimed: 0 },
          })
          .select()
          .single();

        if (campaignError) {
          throw new Error(`Failed to create campaign: ${campaignError.message}`);
        }

        // Queue messages for all clinics
        const template = EMAIL_TEMPLATES[emailType];
        const messages = clinics.map((clinic) => ({
          campaign_id: campaign.id,
          clinic_id: clinic.id,
          recipient_email: clinic.email,
          subject: template.subject
            .replace("{{practice_name}}", clinic.name || "Your Practice"),
          status: "pending",
        }));

        // Insert in batches
        const BATCH_SIZE = 500;
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
          const batch = messages.slice(i, i + BATCH_SIZE);
          await supabaseAdmin.from("outreach_messages").insert(batch);
        }

        // Log the campaign creation
        await supabaseAdmin.from("automation_logs").insert({
          status: "success",
          details: {
            action: "create_outreach_campaign",
            campaign_id: campaign.id,
            email_type: emailType,
            recipient_count: clinics.length,
            user_id: userId,
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            campaignId: campaign.id,
            recipientCount: clinics.length,
            message: `Campaign created with ${clinics.length} recipients`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "send-batch": {
        if (!campaignId) {
          return new Response(
            JSON.stringify({ success: false, error: "Campaign ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get SMTP settings
        const { data: smtpData } = await supabaseAdmin
          .from("global_settings")
          .select("value")
          .eq("key", "smtp")
          .single();

        if (!smtpData?.value) {
          return new Response(
            JSON.stringify({ success: false, error: "SMTP not configured" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get pending messages
        const { data: pendingMessages } = await supabaseAdmin
          .from("outreach_messages")
          .select("id, clinic_id, recipient_email, subject")
          .eq("campaign_id", campaignId)
          .eq("status", "pending")
          .limit(batchSize);

        if (!pendingMessages || pendingMessages.length === 0) {
          return new Response(
            JSON.stringify({ success: true, message: "No pending messages", sent: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Note: Actual email sending would be done via send-outreach function
        // This marks messages as ready for sending
        const messageIds = pendingMessages.map((m) => m.id);
        await supabaseAdmin
          .from("outreach_messages")
          .update({ status: "queued" })
          .in("id", messageIds);

        return new Response(
          JSON.stringify({
            success: true,
            queued: pendingMessages.length,
            message: `${pendingMessages.length} messages queued for sending`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get-stats": {
        if (!campaignId) {
          return new Response(
            JSON.stringify({ success: false, error: "Campaign ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: stats } = await supabaseAdmin
          .from("outreach_messages")
          .select("status")
          .eq("campaign_id", campaignId);

        const counts = {
          pending: 0,
          queued: 0,
          sent: 0,
          opened: 0,
          clicked: 0,
          failed: 0,
          bounced: 0,
        };

        stats?.forEach((s) => {
          if (counts[s.status as keyof typeof counts] !== undefined) {
            counts[s.status as keyof typeof counts]++;
          }
        });

        return new Response(
          JSON.stringify({ success: true, stats: counts }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "pause": {
        if (!campaignId) {
          return new Response(
            JSON.stringify({ success: false, error: "Campaign ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabaseAdmin
          .from("outreach_campaigns")
          .update({ is_active: false })
          .eq("id", campaignId);

        return new Response(
          JSON.stringify({ success: true, message: "Campaign paused" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "resume": {
        if (!campaignId) {
          return new Response(
            JSON.stringify({ success: false, error: "Campaign ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabaseAdmin
          .from("outreach_campaigns")
          .update({ is_active: true })
          .eq("id", campaignId);

        return new Response(
          JSON.stringify({ success: true, message: "Campaign resumed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Phase 3 Outreach error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
