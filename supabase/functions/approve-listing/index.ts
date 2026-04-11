import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBranding, wrapEmailContent, getFromAddress } from "../_shared/branding.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Approve Practice Listing
 * 
 * This function is called when an admin approves a practice listing from the leads CRM.
 * It will:
 * 1. Create a user account with a temporary password
 * 2. Create the clinic profile
 * 3. Assign the dentist role
 * 4. Send email confirmation with login credentials
 * 5. Send SMS confirmation
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { leadId } = await req.json();

    if (!leadId) {
      return new Response(JSON.stringify({ success: false, error: "Lead ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get the lead data
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ success: false, error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the lead message to get listing details
    let listingData: any = {};
    try {
      listingData = JSON.parse(lead.message || "{}");
    } catch {
      // If not JSON, it's an old format lead
      listingData = {
        clinicName: lead.patient_name + "'s Dental Practice",
        dentistName: lead.patient_name,
      };
    }

    const email = lead.patient_email;
    const phone = lead.patient_phone;
    const dentistName = listingData.dentistName || lead.patient_name;
    const clinicName = listingData.clinicName || `${dentistName} Dental Practice`;
    const cityId = listingData.cityId || null;
    const stateId = listingData.stateId || null;
    const streetAddress = listingData.streetAddress || "";
    const website = listingData.website || "";
    const description = listingData.description || "";
    const serviceIds = listingData.serviceIds || [];

    // 2. Generate temporary password
    const tempPassword = generateTempPassword();

    // 3. Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // User exists, update their password
      userId = existingUser.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
      });
    } else {
      // Create new user
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: dentistName,
          phone,
        },
      });

      if (createUserError || !newUser.user) {
        console.error("Failed to create user:", createUserError);
        return new Response(JSON.stringify({ success: false, error: "Failed to create user account" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
    }

    // 4. Assign dentist role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "dentist" }, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("Failed to assign role:", roleError);
    }

    // 5. Create clinic slug (unique, no random codes)
    const baseSlug = clinicName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    
    // Check for existing slugs to ensure uniqueness
    const { data: existingSlugs } = await supabaseAdmin
      .from('clinics')
      .select('slug')
      .like('slug', `${baseSlug}%`);
    
    let slug = baseSlug;
    if (existingSlugs && existingSlugs.length > 0) {
      const exactMatch = existingSlugs.some((row: any) => row.slug === baseSlug);
      if (exactMatch) {
        let counter = 2;
        while (existingSlugs.some((row: any) => row.slug === `${baseSlug}-${counter}`)) {
          counter++;
        }
        slug = `${baseSlug}-${counter}`;
      }
    }

    // 6. Create the clinic
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .insert({
        name: clinicName,
        slug,
        email,
        phone,
        address: streetAddress,
        website,
        description,
        city_id: cityId,
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        claim_status: "claimed",
        verification_status: "pending",
        source: "list-your-practice",
        is_active: true,
      })
      .select("id")
      .single();

    if (clinicError || !clinic) {
      console.error("Failed to create clinic:", clinicError);
      return new Response(JSON.stringify({ success: false, error: "Failed to create clinic" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Add clinic treatments
    if (serviceIds.length > 0) {
      const treatmentInserts = serviceIds.map((treatmentId: string) => ({
        clinic_id: clinic.id,
        treatment_id: treatmentId,
      }));

      await supabaseAdmin.from("clinic_treatments").insert(treatmentInserts);
    }

    // 8. Create primary dentist record with unique slug
    const dentistBaseSlug = dentistName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    
    const { data: existingDentistSlugs } = await supabaseAdmin
      .from('dentists')
      .select('slug')
      .like('slug', `${dentistBaseSlug}%`);
    
    let dentistSlug = dentistBaseSlug;
    if (existingDentistSlugs && existingDentistSlugs.length > 0) {
      const exactMatch = existingDentistSlugs.some((row: any) => row.slug === dentistBaseSlug);
      if (exactMatch) {
        let counter = 2;
        while (existingDentistSlugs.some((row: any) => row.slug === `${dentistBaseSlug}-${counter}`)) {
          counter++;
        }
        dentistSlug = `${dentistBaseSlug}-${counter}`;
      }
    }

    await supabaseAdmin.from("dentists").insert({
      name: dentistName,
      slug: dentistSlug,
      email,
      phone,
      clinic_id: clinic.id,
      is_primary: true,
      is_active: true,
    });

    // 9. Create user onboarding record
    await supabaseAdmin.from("user_onboarding").upsert({
      user_id: userId,
      onboarding_status: "needs_profile",
      first_login_at: null,
      profile_completion_percent: 30,
    }, { onConflict: "user_id" });

    // 10. Update lead status
    await supabaseAdmin
      .from("leads")
      .update({ 
        status: "converted",
        contacted_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    // 11. Send email with login credentials
    if (resendApiKey && email) {
      try {
        const branding = await getBranding(supabaseAdmin);
        const siteUrl = branding.siteUrl;
        
        const bodyContent = `
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">
            Welcome to ${branding.siteName}!
          </h2>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
            Dear Dr. ${dentistName},
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
            Great news! Your practice listing for <strong>${clinicName}</strong> has been approved.
          </p>
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; margin-bottom: 24px;">
            <tr>
              <td style="padding: 24px;">
                <h3 style="margin: 0 0 16px; color: #166534; font-size: 18px;">Your Login Credentials</h3>
                <p style="margin: 0 0 8px; color: #374151;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 0 0 8px; color: #374151;"><strong>Temporary Password:</strong> ${tempPassword}</p>
                <p style="margin: 0; color: #dc2626; font-size: 14px;">⚠️ Please change your password after logging in.</p>
              </td>
            </tr>
          </table>
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
            <tr>
              <td align="center">
                <a href="${siteUrl}/auth" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Log In to Your Dashboard
                </a>
              </td>
            </tr>
          </table>
          
          <h3 style="color: #1e293b; margin: 0 0 16px; font-size: 18px;">Next Steps:</h3>
          <ol style="margin: 0 0 24px; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
            <li>Complete your profile with photos and additional details</li>
            <li>Verify your practice to get a verified badge</li>
            <li>Choose a plan to start receiving patient bookings</li>
          </ol>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
            If you have any questions, reply to this email or contact our support team.
          </p>
        `;

        const emailHtml = wrapEmailContent(branding, '🎉 Your Practice Has Been Approved!', '🎉', bodyContent);
        
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: getFromAddress(branding),
            to: email,
            subject: `Your Practice Listing Has Been Approved! 🎉 - ${branding.siteName}`,
            html: emailHtml,
          }),
        });
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
      }
    }

    // 12. Send SMS confirmation
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (twilioSid && twilioToken && twilioPhone && phone) {
      try {
        const cleanPhone = phone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.startsWith("1") ? `+${cleanPhone}` : `+1${cleanPhone}`;

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: formattedPhone,
            From: twilioPhone,
            Body: `Welcome to AppointPanda! Your practice "${clinicName}" has been approved. Log in at www.appointpanda.com/auth with your email and temp password sent to your inbox.`,
          }),
        });
      } catch (smsError) {
        console.error("Failed to send SMS:", smsError);
      }
    }

    // 13. Create audit log
    await supabaseAdmin.from("audit_logs").insert({
      action: "LISTING_APPROVED",
      entity_type: "clinic",
      entity_id: clinic.id,
      new_values: {
        lead_id: leadId,
        clinic_name: clinicName,
        user_id: userId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        clinicId: clinic.id,
        userId,
        message: "Practice listing approved and user account created",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("approve-listing error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
