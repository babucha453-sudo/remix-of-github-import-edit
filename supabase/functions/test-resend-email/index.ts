import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const body = await req.json().catch(() => ({}));
    const testEmail = body.email || "test@example.com";

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RESEND_API_KEY not configured",
          configured: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AppointPanda <noreply@appointpanda.com>",
        to: [testEmail],
        subject: "AppointPanda Email Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Email System Test</h1>
            <p>This is a test email from <strong>AppointPanda</strong>.</p>
            <p>If you received this, the Resend email integration is working correctly.</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <h2>Email Types Ready to Send:</h2>
            <ul>
              <li>Welcome emails for new dentist signups</li>
              <li>Booking confirmation emails</li>
              <li>Booking cancellation emails</li>
              <li>Appointment reminders</li>
              <li>Review collection requests</li>
              <li>Lead notifications to dentists</li>
              <li>Onboarding sequence emails</li>
              <li>OTP verification emails</li>
            </ul>
            <p style="color: #6b7280; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
          </div>
        `,
        text: "Email System Test - AppointPanda\n\nThis is a test email from AppointPanda. If you received this, the Resend email integration is working correctly.\n\nEmail types ready to send: Welcome emails, Booking confirmations, Cancellation notices, Appointment reminders, Review requests, Lead notifications, Onboarding sequences, OTP codes.",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || "Resend API error",
          status: response.status,
          configured: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test email sent successfully",
        messageId: data.id,
        email: testEmail,
        configured: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unexpected error",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});