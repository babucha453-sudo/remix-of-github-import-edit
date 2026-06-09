import { getBranding, type SiteBranding, getFromAddress } from "./branding.ts";

const DEFAULT_FROM_EMAIL = "no-reply@appointpanda.com";
const DEFAULT_FROM_NAME = "Appoint Panda";
function getSiteUrl(): string {
  return Deno.env.get("SITE_URL") || Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://www.appointpanda.com";
}

export interface EmailResult {
  success: boolean;
  error?: string;
  id?: string;
}

function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n/g, "")
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

export async function getEmailSettings(supabase: any): Promise<{ from_email: string; from_name: string; support_email: string }> {
  try {
    const { data } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "email")
      .single();
    if (data?.value) {
      const s = data.value as any;
      return {
        from_email: s.from_email || DEFAULT_FROM_EMAIL,
        from_name: s.from_name || DEFAULT_FROM_NAME,
        support_email: s.support_email || "support@appointpanda.com",
      };
    }
  } catch {}
  return { from_email: DEFAULT_FROM_EMAIL, from_name: DEFAULT_FROM_NAME, support_email: "support@appointpanda.com" };
}

export async function sendEmail(
  resendApiKey: string,
  to: string,
  subject: string,
  html: string,
  options?: { from?: string; replyTo?: string },
): Promise<EmailResult> {
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  if (!to) {
    return { success: false, error: "No recipient email provided" };
  }
  try {
    const cleanHtml = minifyHtml(html);
    const fromName = DEFAULT_FROM_NAME;
    const fromEmail = DEFAULT_FROM_EMAIL;
    const body: Record<string, any> = {
      from: options?.from || `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html: cleanHtml,
    };
    if (options?.replyTo) body.reply_to = options.replyTo;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const bodyText = await response.text();
    if (response.ok) {
      let id = "";
      try { id = JSON.parse(bodyText)?.id || ""; } catch {}
      return { success: true, id };
    }
    let message = bodyText;
    try { const p = JSON.parse(bodyText); message = p?.message || p?.error || bodyText; } catch {}
    const lower = String(message).toLowerCase();
    if (response.status === 403 && (lower.includes("only send testing emails") || lower.includes("verify a domain"))) {
      return { success: false, error: "Resend domain not verified. Please verify your sending domain in Resend dashboard." };
    }
    return { success: false, error: `Resend API error (${response.status}): ${message}` };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function logEmail(supabase: any, data: {
  recipient: string;
  subject: string;
  type: string;
  status: string;
  error_message?: string;
  resend_id?: string;
  clinic_id?: string;
  user_id?: string;
  appointment_id?: string;
}) {
  try {
    await supabase.from("email_logs").insert({
      recipient: data.recipient,
      subject: data.subject,
      type: data.type,
      status: data.status,
      error_message: data.error_message,
      resend_id: data.resend_id,
      clinic_id: data.clinic_id,
      user_id: data.user_id,
      appointment_id: data.appointment_id,
    });
  } catch (e) {
    console.error("Failed to log email:", e);
  }
}

export function wrapEmail(branding: SiteBranding, title: string, bodyContent: string, emoji = "📧"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<!--[if !mso]><!--><style>.preheader{display:none!important;mso-hide:all;max-height:0;overflow:hidden;line-height:0}</style><!--<![endif]-->
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;-webkit-font-smoothing:antialiased;">
<div style="display:none!important;mso-hide:all;max-height:0;overflow:hidden;line-height:0;color:transparent;font-size:0;">${title.replace(/<[^>]*>/g, '').replace(/['"]/g, '').trim()}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f5;">
<tr><td style="padding:40px 20px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;max-width:600px;">
<tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:40px 32px;text-align:center;border-radius:16px 16px 0 0;">
${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.siteName}" style="max-height:50px;margin-bottom:16px;">` : `<h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#ffffff;">${emoji} ${branding.siteName}</h1>`}
<div style="color:rgba(255,255,255,0.9);font-size:16px;">${title}</div>
</td></tr>
<tr><td style="background-color:#ffffff;padding:40px 32px;">${bodyContent}</td></tr>
<tr><td style="background-color:#1e293b;border-radius:0 0 16px 16px;padding:28px 32px;text-align:center;">
<p style="color:#94a3b8;font-size:13px;margin:0 0 8px;">Need help? <a href="mailto:${branding.supportEmail}" style="color:#14b8a6;text-decoration:none;">${branding.supportEmail}</a></p>
<p style="color:#64748b;font-size:12px;margin:0;">${branding.copyrightText}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function buttonHtml(url: string, text: string, color = "#0d9488"): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="padding:8px 0;">
<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${text}</a>
</td></tr></table>`;
}

export function sectionHtml(content: string, bgColor = "#f8fafc", borderColor = "#e2e8f0"): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${bgColor};border:1px solid ${borderColor};border-radius:12px;margin:20px 0;">
<tr><td style="padding:24px;">${content}</td></tr></table>`;
}

export function textHtml(content: string, color = "#475569", size = "16px", bold = false): string {
  return `<p style="color:${color};font-size:${size};line-height:1.7;margin:0 0 12px;${bold ? "font-weight:600;" : ""}">${content}</p>`;
}

// ============================================================================
// EMAIL TYPE TEMPLATES
// ============================================================================

// --- Appointment Booking ---
export function generateBookingEmailHTML(params: {
  status: string;
  patientName: string;
  clinicName: string;
  clinicLogo?: string;
  appointmentDate: string;
  appointmentTime: string;
  treatmentName: string;
  manageToken: string;
  mapLink?: string;
  clinicId?: string;
  clinicSlug: string;
  primaryColor?: string;
}): string {
  const { status, patientName, clinicName, clinicLogo, appointmentDate, appointmentTime, treatmentName, manageToken, mapLink, clinicId, clinicSlug, primaryColor } = params;
  const siteUrl = getSiteUrl();
  const color = primaryColor || "#0d9488";
  const manageUrl = `${siteUrl}/appointment/${manageToken}`;
  const rescheduleUrl = `${siteUrl}/appointment/${manageToken}?action=reschedule`;
  const cancelUrl = `${siteUrl}/appointment/${manageToken}?action=cancel`;
  const rebookUrl = `${siteUrl}/clinic/${clinicSlug}`;
  const reviewUrl = `${siteUrl}/review/${clinicId || clinicSlug}`;

  const configs: Record<string, { title: string; emoji: string; gradient: string; message: string; showManage: boolean; showRebook: boolean }> = {
    pending:     { title: "Booking Request Received", emoji: "📅", gradient: `linear-gradient(135deg,${color} 0%,#0891b2 100%)`, message: `Thank you for your booking request for ${clinicName}! We have received it and will confirm shortly.`, showManage: true, showRebook: false },
    confirmed:   { title: "Appointment Confirmed", emoji: "✅", gradient: "linear-gradient(135deg,#10b981 0%,#059669 100%)", message: `Great news! Your appointment at ${clinicName} has been confirmed.`, showManage: true, showRebook: false },
    completed:   { title: "Thank You for Your Visit", emoji: "🙏", gradient: "linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)", message: `Thank you for visiting ${clinicName}! We hope you had a wonderful experience.`, showManage: false, showRebook: true },
    cancelled:   { title: "Appointment Cancelled", emoji: "❌", gradient: "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)", message: `Your appointment at ${clinicName} has been cancelled. Book again anytime.`, showManage: false, showRebook: true },
    no_show:     { title: "We Missed You", emoji: "👋", gradient: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)", message: `We missed you at ${clinicName}. Reschedule or book a new appointment.`, showManage: true, showRebook: true },
    rescheduled: { title: "Appointment Rescheduled", emoji: "🔄", gradient: "linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)", message: `Your appointment at ${clinicName} has been rescheduled. Details below.`, showManage: true, showRebook: false },
    reminder:    { title: "Appointment Reminder", emoji: "⏰", gradient: "linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%)", message: `This is a reminder for your upcoming appointment at ${clinicName} tomorrow.`, showManage: true, showRebook: false },
  };
  const cfg = configs[status] || configs.pending;

  const header = cfg.showManage ? `background:${cfg.gradient};border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;` : "";
  const details = sectionHtml(`
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr><td colspan="2" style="padding-bottom:12px;border-bottom:1px solid ${color}33;"><span style="color:${color};font-size:14px;font-weight:600;">📋 Appointment Details</span></td></tr>
      <tr><td style="padding:10px 0 0;color:#64748b;font-size:14px;width:100px;">Treatment</td><td style="padding:10px 0 0;color:#1e293b;font-size:15px;font-weight:600;">${treatmentName}</td></tr>
      <tr><td style="padding:8px 0 0;color:#64748b;font-size:14px;">Date</td><td style="padding:8px 0 0;color:#1e293b;font-size:15px;font-weight:600;">${appointmentDate}</td></tr>
      <tr><td style="padding:8px 0 0;color:#64748b;font-size:14px;">Time</td><td style="padding:8px 0 0;color:#1e293b;font-size:15px;font-weight:600;">${appointmentTime}</td></tr>
      ${mapLink ? `<tr><td style="padding:8px 0 0;color:#64748b;font-size:14px;">Location</td><td style="padding:8px 0 0;color:#1e293b;font-size:14px;"><a href="${mapLink}" style="color:${color};text-decoration:none;">View on Map</a></td></tr>` : ""}
    </table>`, "#f0fdfa", `${color}44`);

  const actions = cfg.showManage ? `
    ${buttonHtml(manageUrl, "View Appointment", color)}
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
      <td align="center" style="padding:8px;"><a href="${rescheduleUrl}" style="display:inline-block;background:#f1f5f9;color:#475569;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:500;font-size:14px;border:1px solid #e2e8f0;">🔄 Reschedule</a></td>
      <td align="center" style="padding:8px;"><a href="${cancelUrl}" style="display:inline-block;background:#fef2f2;color:#dc2626;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:500;font-size:14px;border:1px solid #fecaca;">❌ Cancel</a></td>
    </tr></table>` : "";

  const rebook = cfg.showRebook ? sectionHtml(`
    <p style="color:#0369a1;font-size:15px;margin:0 0 16px;font-weight:500;">Ready for your next visit?</p>
    ${buttonHtml(rebookUrl, "📅 Book New Appointment", color)}`, "#f0f9ff", "#bae6fd") : "";

  const reviewPrompt = status === "completed" ? sectionHtml(`
    <p style="color:#78350f;font-size:16px;margin:0 0 16px;font-weight:500;">We value your feedback!</p>
    ${buttonHtml(reviewUrl, "⭐ Leave a Review", "#f59e0b")}`, "#fef3c7", "#fcd34d") : "";

  const reminderTips = status === "reminder" ? sectionHtml(`
    <p style="color:#92400e;font-size:14px;margin:0;line-height:1.5;"><strong>⏰ Tips:</strong> Arrive 10-15 minutes early. Bring insurance card and ID.</p>`, "#fef3c7", "#fcd34d") : "";

  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Hello ${patientName},</h2>
    ${textHtml(cfg.message)}
    ${details}
    ${actions}
    ${reminderTips}
    ${reviewPrompt}
    ${rebook}
    <p style="color:#64748b;font-size:14px;margin:20px 0 0;border-top:1px solid #e2e8f0;padding-top:20px;">
      This email was sent by <strong>${clinicName}</strong> via AppointPanda.
    </p>`;

  const branding: SiteBranding = {
    siteName: clinicName,
    domain: "appointpanda.com",
    siteUrl,
    logoUrl: clinicLogo || "",
    logoDarkUrl: "",
    faviconUrl: "",
    supportEmail: "support@appointpanda.com",
    fromEmail: DEFAULT_FROM_EMAIL,
    fromName: DEFAULT_FROM_NAME,
    primaryColor: color,
    copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda`,
  };
  return wrapEmail(branding, cfg.title, body, cfg.emoji);
}

// --- Welcome Email ---
export function generateWelcomeEmailHTML(params: {
  firstName: string;
  clinicName: string;
  profileUrl: string;
  dashboardUrl: string;
  logoUrl?: string;
}): string {
  const { firstName, clinicName, profileUrl, dashboardUrl, logoUrl } = params;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Welcome to AppointPanda, ${firstName}! 🎉</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">
      Congratulations on setting up your profile for <strong>${clinicName}</strong>. You are now part of the AppointPanda network!
    </p>
    <h3 style="color:#1e293b;margin:24px 0 12px;font-size:18px;font-weight:600;">🚀 Your Quick Start Guide</h3>
    ${sectionHtml(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="padding:8px 0;color:#475569;"><strong>1.</strong> Complete your clinic profile</td></tr>
        <tr><td style="padding:8px 0;color:#475569;"><strong>2.</strong> Add your services and pricing</td></tr>
        <tr><td style="padding:8px 0;color:#475569;"><strong>3.</strong> Set your availability hours</td></tr>
        <tr><td style="padding:8px 0;color:#475569;"><strong>4.</strong> Start accepting online bookings</td></tr>
      </table>`, "#f0fdfa", "#14b8a6")}
    ${buttonHtml(profileUrl, "Complete Your Profile", "#0d9488")}
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:20px 0 0;">
      💡 <strong>Pro Tip:</strong> Clinics with complete profiles get <strong>3x more bookings</strong>. Add photos, services, and your team!
    </p>
    <p style="color:#64748b;font-size:14px;margin:20px 0 0;border-top:1px solid #e2e8f0;padding-top:20px;">
      Need help? Reply to this email or visit our <a href="${dashboardUrl}" style="color:#0d9488;text-decoration:none;">help center</a>.
    </p>`;
  const branding: SiteBranding = {
    siteName: "AppointPanda", domain: "appointpanda.com", siteUrl: getSiteUrl(),
    logoUrl: logoUrl || "", logoDarkUrl: "", faviconUrl: "",
    supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL,
    fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488",
    copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda. All rights reserved.`,
  };
  return wrapEmail(branding, "Welcome to AppointPanda! 🎉", body, "🐼");
}

// --- Review Request ---
export function generateReviewRequestHTML(params: {
  patientName: string;
  clinicName: string;
  clinicLogo?: string;
  reviewLink: string;
  googleReviewLink?: string;
  customMessage?: string;
  primaryColor?: string;
}): string {
  const { patientName, clinicName, clinicLogo, reviewLink, googleReviewLink, customMessage, primaryColor } = params;
  const color = primaryColor || "#0d9488";
  const message = customMessage || `Your feedback helps ${clinicName} improve and helps other patients find great care.`;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Hi ${patientName},</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">${message}</p>
    ${buttonHtml(reviewLink, "⭐ Leave a Review", color)}
    ${googleReviewLink ? `<p style="color:#64748b;font-size:14px;margin:12px 0 0;text-align:center;">Or leave a review on <a href="${googleReviewLink}" style="color:#4285f4;text-decoration:none;">Google</a></p>` : ""}
    <p style="color:#94a3b8;font-size:13px;margin:20px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      Your feedback is anonymous and will be shared publicly. You received this because you recently visited ${clinicName}.
    </p>`;
  const branding: SiteBranding = { siteName: clinicName, domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: clinicLogo || "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: color, copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, `Share Your Experience - ${clinicName}`, body, "⭐");
}

// --- Lead Notification ---
export function generateLeadNotificationHTML(params: {
  clinicName: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  service?: string;
  message?: string;
  dashboardUrl: string;
  logoUrl?: string;
}): string {
  const { clinicName, patientName, patientEmail, patientPhone, service, message, dashboardUrl, logoUrl } = params;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">New Lead for ${clinicName} 👋</h2>
    <p style="color:#475569;font-size:16px;margin:0 0 20px;">A new patient is interested in your services!</p>
    ${sectionHtml(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="padding:8px 0;color:#64748b;">Name</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">${patientName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;color:#1e293b;"><a href="mailto:${patientEmail}" style="color:#0d9488;">${patientEmail}</a></td></tr>
        ${patientPhone ? `<tr><td style="padding:8px 0;color:#64748b;">Phone</td><td style="padding:8px 0;color:#1e293b;">${patientPhone}</td></tr>` : ""}
        ${service ? `<tr><td style="padding:8px 0;color:#64748b;">Service</td><td style="padding:8px 0;color:#1e293b;">${service}</td></tr>` : ""}
        ${message ? `<tr><td style="padding:8px 0;color:#64748b;">Message</td><td style="padding:8px 0;color:#1e293b;">${message}</td></tr>` : ""}
      </table>`, "#f0fdfa", "#14b8a6")}
    ${buttonHtml(dashboardUrl, "View Lead in Dashboard", "#0d9488")}
    <p style="color:#64748b;font-size:14px;margin:20px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      💡 <strong>Tip:</strong> Respond quickly! Leads contacted within 1 hour convert at 7x higher rates.
    </p>`;
  const branding: SiteBranding = { siteName: clinicName, domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: logoUrl || "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, `New Lead - ${clinicName}`, body, "👋");
}

// --- Password Reset ---
export function generatePasswordResetHTML(params: {
  resetLink: string;
  userName: string;
  expiresIn?: string;
}): string {
  const { resetLink, userName, expiresIn = "1 hour" } = params;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Password Reset Request</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Hi ${userName},</p>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">We received a request to reset your password. Click the button below to set a new one.</p>
    ${buttonHtml(resetLink, "🔑 Reset Password", "#0d9488")}
    <p style="color:#94a3b8;font-size:14px;margin:20px 0 0;text-align:center;">This link expires in ${expiresIn}.</p>
    <p style="color:#94a3b8;font-size:13px;margin:12px 0 0;text-align:center;">If you didn't request this, you can safely ignore this email.</p>`;
  const branding: SiteBranding = { siteName: "AppointPanda", domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, "Password Reset", body, "🔑");
}

// --- Claim Profile Success ---
export function generateClaimSuccessHTML(params: {
  clinicName: string;
  userName: string;
  dashboardUrl: string;
  clinicLogo?: string;
}): string {
  const { clinicName, userName, dashboardUrl, clinicLogo } = params;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Welcome, ${userName}! 🎉</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">You have successfully claimed <strong>${clinicName}</strong> on AppointPanda. You now have full control over your profile.</p>
    <h3 style="color:#1e293b;margin:24px 0 12px;font-size:18px;font-weight:600;">🔑 What You Can Do Now</h3>
    ${sectionHtml(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="padding:8px 0;color:#475569;">✅ Update clinic information and photos</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">✅ Manage services and pricing</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">✅ Set availability and accept bookings</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">✅ Respond to patient reviews</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">✅ Track analytics and performance</td></tr>
      </table>`, "#f0fdfa", "#14b8a6")}
    ${buttonHtml(dashboardUrl, "Go to Your Dashboard", "#0d9488")}
    <p style="color:#64748b;font-size:14px;margin:20px 0 0;border-top:1px solid #e2e8f0;padding-top:20px;">
      Need help? Contact <a href="mailto:support@appointpanda.com" style="color:#0d9488;">support@appointpanda.com</a>
    </p>`;
  const branding: SiteBranding = { siteName: clinicName, domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: clinicLogo || "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, "Profile Claimed Successfully! 🎉", body, "🎉");
}

// --- Team Invitation ---
export function generateTeamInviteHTML(params: {
  clinicName: string;
  inviteUrl: string;
  inviterName: string;
  role: string;
}): string {
  const { clinicName, inviteUrl, inviterName, role } = params;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">You're Invited to Join ${clinicName} 🏥</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Hi there,</p>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;"><strong>${inviterName}</strong> has invited you to join <strong>${clinicName}</strong> on AppointPanda as a <strong>${role}</strong>.</p>
    ${buttonHtml(inviteUrl, "Accept Invitation", "#0d9488")}
    <p style="color:#94a3b8;font-size:14px;margin:20px 0 0;">This invitation link will expire in 7 days.</p>`;
  const branding: SiteBranding = { siteName: clinicName, domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, `Invitation to join ${clinicName}`, body, "🏥");
}

// --- Listing Confirmation ---
export function generateListingConfirmationHTML(params: {
  clinicName: string;
  userName: string;
  dashboardUrl: string;
}): string {
  const { clinicName, userName, dashboardUrl } = params;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Listing Submitted! 🎉</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Hi ${userName},</p>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Thank you for submitting your listing for <strong>${clinicName}</strong>. Our team is reviewing it and will get back to you shortly.</p>
    <h3 style="color:#1e293b;margin:24px 0 12px;font-size:16px;font-weight:600;">📋 What Happens Next</h3>
    ${sectionHtml(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="padding:8px 0;color:#475569;">1. Review by our team (typically within 24 hours)</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">2. Profile goes live on AppointPanda</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">3. Start receiving patient enquiries</td></tr>
      </table>`, "#f0fdfa", "#14b8a6")}
    ${buttonHtml(dashboardUrl, "Track Status", "#0d9488")}
    <p style="color:#64748b;font-size:14px;margin:20px 0 0;">Questions? Contact <a href="mailto:support@appointpanda.com" style="color:#0d9488;">support@appointpanda.com</a></p>`;
  const branding: SiteBranding = { siteName: "AppointPanda", domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, "Listing Submitted Successfully", body, "🎉");
}

// --- Approval with Credentials ---
export function generateApprovalCredentialsHTML(params: {
  clinicName: string;
  userName: string;
  email: string;
  resetLink: string;
  loginUrl: string;
}): string {
  const { clinicName, userName, email, resetLink, loginUrl } = params;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Your Listing is Approved! ✅</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Congratulations ${userName},</p>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Your listing for <strong>${clinicName}</strong> has been approved and is now live on AppointPanda!</p>
    ${sectionHtml(`
      <p style="color:#475569;font-size:15px;margin:0 0 12px;font-weight:600;">Your Account</p>
      <p style="color:#1e293b;font-size:14px;margin:0 0 8px;"><strong>Email:</strong> ${email}</p>
      <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">Use the button below to set your password and sign in.</p>`, "#f0fdfa", "#14b8a6")}
    ${buttonHtml(resetLink, "Set Your Password", "#0d9488")}
    ${buttonHtml(loginUrl, "Sign In to Dashboard", "#0d9488")}
    <p style="color:#64748b;font-size:14px;margin:20px 0 0;">Need help? <a href="mailto:support@appointpanda.com" style="color:#0d9488;">support@appointpanda.com</a></p>`;
  const branding: SiteBranding = { siteName: "AppointPanda", domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, "Listing Approved! ✅", body, "✅");
}

// --- Appointment Reminder ---
export function generateAppointmentReminderHTML(params: {
  patientName: string;
  clinicName: string;
  clinicLogo?: string;
  appointmentDate: string;
  appointmentTime: string;
  treatmentName: string;
  manageToken: string;
  clinicPhone?: string;
  clinicAddress?: string;
  mapLink?: string;
}): string {
  const { patientName, clinicName, clinicLogo, appointmentDate, appointmentTime, treatmentName, manageToken, clinicPhone, clinicAddress, mapLink } = params;
  const manageUrl = `${getSiteUrl()}/appointment/${manageToken}`;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">⏰ Reminder: Your Appointment is Tomorrow</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Hi ${patientName},</p>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">This is a friendly reminder that you have an appointment at <strong>${clinicName}</strong> tomorrow.</p>
    ${sectionHtml(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td colspan="2" style="padding-bottom:12px;border-bottom:1px solid #0ea5e933;"><span style="color:#0ea5e9;font-size:14px;font-weight:600;">📋 Appointment Details</span></td></tr>
        <tr><td style="padding:10px 0 0;color:#64748b;font-size:14px;width:100px;">Date</td><td style="padding:10px 0 0;color:#1e293b;font-size:15px;font-weight:600;">${appointmentDate}</td></tr>
        <tr><td style="padding:8px 0 0;color:#64748b;font-size:14px;">Time</td><td style="padding:8px 0 0;color:#1e293b;font-size:15px;font-weight:600;">${appointmentTime}</td></tr>
        <tr><td style="padding:8px 0 0;color:#64748b;font-size:14px;">Treatment</td><td style="padding:8px 0 0;color:#1e293b;font-size:15px;font-weight:600;">${treatmentName}</td></tr>
        <tr><td style="padding:8px 0 0;color:#64748b;font-size:14px;">Clinic</td><td style="padding:8px 0 0;color:#1e293b;font-size:15px;font-weight:600;">${clinicName}</td></tr>
        ${clinicAddress ? `<tr><td style="padding:8px 0 0;color:#64748b;font-size:14px;">Address</td><td style="padding:8px 0 0;color:#1e293b;font-size:14px;">${mapLink ? `<a href="${mapLink}" style="color:#0d9488;text-decoration:none;">${clinicAddress}</a>` : clinicAddress}</td></tr>` : ""}
        ${clinicPhone ? `<tr><td style="padding:8px 0 0;color:#64748b;font-size:14px;">Phone</td><td style="padding:8px 0 0;color:#1e293b;font-size:14px;"><a href="tel:${clinicPhone}" style="color:#0d9488;text-decoration:none;">${clinicPhone}</a></td></tr>` : ""}
      </table>`, "#f0f9ff", "#0ea5e966")}
    ${sectionHtml(`<p style="color:#92400e;font-size:14px;margin:0;line-height:1.5;"><strong>⏰ Tips:</strong> Please arrive 10-15 minutes early. Bring your insurance card and ID. If you need to reschedule, use the button below.</p>`, "#fef3c7", "#fcd34d")}
    ${buttonHtml(manageUrl, "View / Manage Appointment", "#0d9488")}
    <p style="color:#94a3b8;font-size:13px;margin:20px 0 0;">If you need to reschedule or cancel, click the button above.</p>`;
  const branding: SiteBranding = { siteName: clinicName, domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: clinicLogo || "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, `Reminder: Appointment at ${clinicName} Tomorrow`, body, "⏰");
}

// --- Claim Status Update ---
export function generateClaimStatusUpdateHTML(params: {
  clinicName: string;
  userName: string;
  status: string;
  message: string;
  dashboardUrl?: string;
}): string {
  const { clinicName, userName, status, message, dashboardUrl } = params;
  const emoji = status === "approved" ? "✅" : status === "rejected" ? "❌" : status === "pending_review" ? "🔄" : "📋";
  const color = status === "approved" ? "#10b981" : status === "rejected" ? "#ef4444" : "#f59e0b";
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Claim Status Update ${emoji}</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Hi ${userName},</p>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">The claim status for <strong>${clinicName}</strong> has been updated to: <strong style="color:${color};">${status.replace("_", " ").toUpperCase()}</strong></p>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">${message}</p>
    ${dashboardUrl ? buttonHtml(dashboardUrl, "View in Dashboard", color) : ""}
    <p style="color:#64748b;font-size:14px;margin:20px 0 0;">Questions? <a href="mailto:support@appointpanda.com" style="color:#0d9488;">support@appointpanda.com</a></p>`;
  const branding: SiteBranding = { siteName: "AppointPanda", domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: color, copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, `Claim ${status.replace("_", " ")} - ${clinicName}`, body, emoji);
}

// --- Onboarding Reminder ---
export function generateOnboardingReminderHTML(params: {
  firstName: string;
  clinicName: string;
  profileUrl: string;
  completionPercent?: number;
  day: number;
}): string {
  const { firstName, clinicName, profileUrl, completionPercent, day } = params;
  const tips = [
    "Add high-quality photos of your clinic to build trust with potential patients.",
    "List all services with detailed descriptions and pricing.",
    "Set your availability hours so patients can book online instantly.",
    "Respond to existing reviews to show you value patient feedback.",
    "Complete your team profile with dentist bios and credentials.",
  ];
  const body = day === 0 ? `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Welcome to AppointPanda, ${firstName}! 🚀</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Thank you for joining with <strong>${clinicName}</strong>. Here's your first-week checklist to get started:</p>
    ${sectionHtml(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${["Complete your clinic profile", "Add services and pricing", "Set availability hours", "Upload clinic photos", "Invite your team"].map((item, i) =>
          `<tr><td style="padding:8px 0;color:#475569;"><strong>${i+1}.</strong> ${item}</td></tr>`
        ).join("")}
      </table>`, "#f0fdfa", "#14b8a6")}
    ${buttonHtml(profileUrl, "Complete Your Profile", "#0d9488")}
  ` : day === 3 ? `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Don't Forget to Complete Your Profile! 🎯</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Hi ${firstName}, just a reminder to complete your <strong>${clinicName}</strong> profile.</p>
    ${completionPercent !== undefined ? sectionHtml(`
      <p style="color:#475569;font-size:15px;margin:0 0 12px;font-weight:600;">Profile Completion: ${completionPercent}%</p>
      <div style="background:#e2e8f0;border-radius:8px;height:12px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#0d9488,#14b8a6);width:${completionPercent}%;height:100%;border-radius:8px;"></div>
      </div>`, "#f8fafc", "#e2e8f0") : ""}
    ${buttonHtml(profileUrl, "Continue Setup", "#0d9488")}
  ` : `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Tips to Get More Bookings 💡</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Hi ${firstName}, here are expert tips to maximize your presence on AppointPanda:</p>
    ${sectionHtml(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${tips.map((tip, i) => `<tr><td style="padding:8px 0;color:#475569;">${i+1}. ${tip}</td></tr>`).join("")}
      </table>`, "#f0fdfa", "#14b8a6")}
    ${buttonHtml(profileUrl, "Go to Dashboard", "#0d9488")}
  `;
  const branding: SiteBranding = { siteName: "AppointPanda", domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, day === 0 ? "Welcome! Get Started 🚀" : day === 3 ? "Complete Your Profile 🎯" : "Tips for More Bookings 💡", body, day === 0 ? "🚀" : day === 3 ? "🎯" : "💡");
}

// --- Profile Completion Reminder ---
export function generateProfileCompletionReminderHTML(params: {
  firstName: string;
  clinicName: string;
  profileUrl: string;
  completionPercent: number;
  missingFields: string[];
}): string {
  const { firstName, clinicName, profileUrl, completionPercent, missingFields } = params;
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;font-weight:600;">Your Profile Needs Attention 📋</h2>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 12px;">Hi ${firstName},</p>
    <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Your profile for <strong>${clinicName}</strong> is only <strong>${completionPercent}% complete</strong>. Complete profiles get 3x more patient bookings!</p>
    ${sectionHtml(`
      <p style="color:#475569;font-size:15px;margin:0 0 12px;font-weight:600;">Missing Fields:</p>
      <ul style="color:#64748b;font-size:14px;margin:0;padding-left:20px;">
        ${missingFields.map(f => `<li style="padding:4px 0;">${f}</li>`).join("")}
      </ul>`, "#fef2f2", "#fecaca")}
    ${buttonHtml(profileUrl, "Complete Your Profile", "#0d9488")}
    <p style="color:#94a3b8;font-size:13px;margin:20px 0 0;">Minimum 70% completion required to go live.</p>`;
  const branding: SiteBranding = { siteName: "AppointPanda", domain: "appointpanda.com", siteUrl: getSiteUrl(), logoUrl: "", logoDarkUrl: "", faviconUrl: "", supportEmail: "support@appointpanda.com", fromEmail: DEFAULT_FROM_EMAIL, fromName: DEFAULT_FROM_NAME, primaryColor: "#0d9488", copyrightText: `\u00A9 ${new Date().getFullYear()} AppointPanda` };
  return wrapEmail(branding, "Complete Your Profile", body, "📋");
}
