import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "get" | "submit";

interface PatientFormRequest {
  mode: Mode;
  submissionId: string;
  token?: string | null;
  formData?: Record<string, unknown>;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEq(a?: string | null, b?: string | null) {
  return typeof a === "string" && typeof b === "string" && a.length > 0 && a === b;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as PatientFormRequest;

    if (!body?.submissionId || !body?.mode) {
      return json(400, { error: "Missing submissionId or mode" });
    }

    const { submissionId, mode, token } = body;

    const { data: submission, error: submissionError } = await supabase
      .from("patient_form_submissions")
      .select(
        `
        id,
        clinic_id,
        template_id,
        status,
        submitted_at,
        expires_at,
        access_token,
        patient_email,
        patient_phone,
        form_data,
        created_at,
        updated_at,
        template:intake_form_templates!template_id(id, name, description, form_type, fields),
        clinic:clinics!clinic_id(id, name, slug)
      `
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError) {
      console.error("patient-form: load submission error", submissionError);
      return json(500, { error: "Failed to load form" });
    }

    if (!submission) {
      return json(404, { error: "Form not found" });
    }

    // If token exists in DB, require it. (Backward compatible: if null, allow access.)
    const dbToken = submission.access_token as string | null;
    if (dbToken && !safeEq(dbToken, token ?? null)) {
      return json(404, { error: "Form not found" });
    }

    // Optional expiration
    const expiresAt = submission.expires_at as string | null;
    if (expiresAt) {
      const exp = new Date(expiresAt).getTime();
      if (!Number.isNaN(exp) && Date.now() > exp) {
        return json(410, { error: "This form link has expired" });
      }
    }

    if (mode === "get") {
      // Never return access_token back to the client
      const { access_token: _access, ...safeSubmission } = submission as any;
      return json(200, { submission: safeSubmission });
    }

    if (mode === "submit") {
      if (!body.formData || typeof body.formData !== "object") {
        return json(400, { error: "Missing formData" });
      }

      // Prevent duplicate submit
      if (submission.status === "completed" || submission.submitted_at) {
        const { access_token: _access, ...safeSubmission } = submission as any;
        return json(200, { success: true, alreadySubmitted: true, submission: safeSubmission });
      }

      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("patient_form_submissions")
        .update({
          form_data: body.formData,
          status: "completed",
          submitted_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", submissionId);

      if (updateError) {
        console.error("patient-form: update error", updateError);
        return json(500, { error: "Failed to submit form" });
      }

      // Notify dentist (best-effort)
      try {
        const template = (submission as any).template;
        const clinic = (submission as any).clinic;
        const formName = template?.name || "Intake Form";

        const fd = body.formData as Record<string, unknown>;
        const patientName =
          (typeof fd.full_name === "string" && fd.full_name) ||
          (typeof fd.name === "string" && fd.name) ||
          (typeof fd.patient_name === "string" && fd.patient_name) ||
          undefined;

        await fetch(`${supabaseUrl}/functions/v1/notify-dentist-submission`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            submissionId,
            patientName,
            patientEmail: submission.patient_email || undefined,
            patientPhone: submission.patient_phone || undefined,
            formName,
            clinicId: clinic?.id,
          }),
        });
      } catch (e) {
        console.error("patient-form: notify error", e);
      }

      return json(200, { success: true });
    }

    return json(400, { error: "Invalid mode" });
  } catch (e) {
    console.error("patient-form: unhandled", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
