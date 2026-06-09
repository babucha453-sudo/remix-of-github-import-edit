import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBranding, wrapEmailContent, getFromAddress } from "../_shared/branding.ts";
import { sendEmail, logEmail } from "../_shared/email.ts";

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

    const { reviewId, reviewType } = await req.json();
    if (!reviewId || !reviewType) {
      return new Response(JSON.stringify({ error: "reviewId and reviewType required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let clinicId: string;
    let rating: number;
    let patientName: string | null;
    let comment: string | null;
    let clinic: { name: string; email: string | null; slug: string; claimed_by: string | null };

    if (reviewType === "platform") {
      const { data, error } = await supabase
        .from("platform_reviews")
        .select("*, clinics!inner(name, email, slug, claimed_by)")
        .eq("id", reviewId)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Platform review not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      clinicId = data.clinic_id;
      rating = data.rating;
      patientName = data.patient_name;
      comment = data.review_text || data.comment;
      clinic = data.clinics;
    } else if (reviewType === "internal") {
      const { data, error } = await supabase
        .from("internal_reviews")
        .select("*, clinics!inner(name, email, slug, claimed_by)")
        .eq("id", reviewId)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Internal review not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      clinicId = data.clinic_id;
      rating = data.rating;
      patientName = data.patient_name;
      comment = data.comment;
      clinic = data.clinics;
    } else {
      return new Response(JSON.stringify({ error: "Invalid reviewType. Must be 'platform' or 'internal'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: automationSettings } = await supabase
      .from("clinic_automation_settings")
      .select("notification_config")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    const config = (automationSettings as any)?.notification_config || {};
    const isNegative = rating < 4;

    if (reviewType === "platform") {
      if (config.notify_new_review === false) {
        return new Response(JSON.stringify({ message: "New review notifications disabled" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      if (config.notify_negative_feedback === false || !isNegative) {
        return new Response(JSON.stringify({ message: "Negative feedback notifications disabled or rating not negative" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let notificationEmail = clinic.email;
    if (!notificationEmail && clinic.claimed_by) {
      const { data: authData } = await supabase.auth.admin.getUserById(clinic.claimed_by);
      notificationEmail = authData?.user?.email;
    }

    if (!notificationEmail) {
      return new Response(JSON.stringify({ message: "No notification email configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const branding = await getBranding(supabase);
    const stars = "\u2B50".repeat(Math.min(Math.max(rating, 1), 5));
    const dashboardUrl = `${branding.siteUrl}/dashboard`;

    if (reviewType === "platform") {
      const subject = `New Review for ${clinic.name} - ${stars} - ${branding.siteName}`;
      const bodyContent = `
        <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 22px; font-weight: 600;">
          New Review Received \u2B50
        </h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
          Your clinic <strong>${clinic.name}</strong> has received a new review.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 24px;">
              <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Rating</p>
              <p style="color: #15803d; font-size: 24px; margin: 0 0 12px;">${stars}</p>
              ${patientName ? `<p style="color: #64748b; font-size: 13px; margin: 0 0 4px;">by ${patientName}</p>` : ""}
              ${comment ? `<p style="color: #374151; font-size: 14px; margin: 12px 0 0; font-style: italic;">&ldquo;${comment}&rdquo;</p>` : ""}
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
          <tr>
            <td align="center">
              <a href="${dashboardUrl}?tab=reviews" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View All Reviews
              </a>
            </td>
          </tr>
        </table>
        <p style="color: #64748b; font-size: 14px; margin: 0; text-align: center;">
          Manage your reviews and respond from your dashboard.
        </p>`;
      const emailHtml = wrapEmailContent(branding, "New Review Received \u2B50", "\u2B50", bodyContent);
      await sendEmail(resendApiKey, notificationEmail, subject, emailHtml, { from: getFromAddress(branding) });
      await logEmail(supabase, {
        recipient: notificationEmail,
        subject,
        type: "new_review_notification",
        status: "sent",
        clinic_id: clinicId,
      });
    } else {
      const subject = `\u26A0\uFE0F Negative Feedback Received for ${clinic.name} - ${branding.siteName}`;
      const bodyContent = `
        <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 22px; font-weight: 600;">
          Negative Feedback Received \u26A0\uFE0F
        </h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
          Your clinic <strong>${clinic.name}</strong> has received negative feedback.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 24px;">
              <p style="color: #991b1b; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Rating</p>
              <p style="color: #dc2626; font-size: 24px; margin: 0 0 12px;">${stars}</p>
              ${patientName ? `<p style="color: #64748b; font-size: 13px; margin: 0 0 4px;">by ${patientName}</p>` : ""}
              ${comment ? `<p style="color: #374151; font-size: 14px; margin: 12px 0 0; font-style: italic;">&ldquo;${comment}&rdquo;</p>` : ""}
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
          <tr>
            <td align="center">
              <a href="${dashboardUrl}?tab=feedback" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Feedback Details
              </a>
            </td>
          </tr>
        </table>
        <p style="color: #64748b; font-size: 14px; margin: 0; text-align: center;">
          We recommend addressing this feedback promptly. Respond from your dashboard.
        </p>`;
      const emailHtml = wrapEmailContent(branding, "\u26A0\uFE0F Negative Feedback Received", "\u26A0\uFE0F", bodyContent);
      await sendEmail(resendApiKey, notificationEmail, subject, emailHtml, { from: getFromAddress(branding) });
      await logEmail(supabase, {
        recipient: notificationEmail,
        subject,
        type: "negative_feedback_alert",
        status: "sent",
        clinic_id: clinicId,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-dentist-review error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
