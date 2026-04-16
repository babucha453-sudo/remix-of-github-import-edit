import { supabase } from "@/integrations/supabase/client";

export interface InsuranceSyncResult {
  success: boolean;
  totalClinics: number;
  totalInsurances: number;
  linksCreated: number;
  linksAlreadyExist: number;
  errors: string[];
}

/**
 * Sync all insurances to all clinics - assigns every insurance to every clinic
 * This runs the business rule: ALL profiles accept ALL insurances by default
 */
export async function syncAllInsurancesToAllClinics(): Promise<InsuranceSyncResult> {
  const result: InsuranceSyncResult = {
    success: false,
    totalClinics: 0,
    totalInsurances: 0,
    linksCreated: 0,
    linksAlreadyExist: 0,
    errors: [],
  };

  try {
    // Get all active clinics
    const { data: clinics, error: clinicError } = await supabase
      .from("clinics")
      .select("id")
      .eq("is_active", true);

    if (clinicError) {
      result.errors.push(`Failed to fetch clinics: ${clinicError.message}`);
      return result;
    }

    // Get all active insurances
    const { data: insurances, error: insuranceError } = await supabase
      .from("insurances")
      .select("id")
      .eq("is_active", true);

    if (insuranceError) {
      result.errors.push(`Failed to fetch insurances: ${insuranceError.message}`);
      return result;
    }

    result.totalClinics = clinics?.length || 0;
    result.totalInsurances = insurances?.length || 0;

    if (clinics?.length === 0 || insurances?.length === 0) {
      result.success = true;
      return result;
    }

    // Get existing links
    const { data: existingLinks, error: existingError } = await supabase
      .from("clinic_insurances")
      .select("clinic_id, insurance_id");

    if (existingError) {
      result.errors.push(`Failed to fetch existing links: ${existingError.message}`);
      return result;
    }

    const existingSet = new Set(
      (existingLinks || []).map((l) => `${l.clinic_id}-${l.insurance_id}`)
    );

    // Build all combinations
    const allCombos: { clinic_id: string; insurance_id: string }[] = [];
    for (const clinic of clinics) {
      for (const insurance of insurances) {
        const key = `${clinic.id}-${insurance.id}`;
        if (!existingSet.has(key)) {
          allCombos.push({ clinic_id: clinic.id, insurance_id: insurance.id });
          result.linksCreated++;
        } else {
          result.linksAlreadyExist++;
        }
      }
    }

    // Batch insert missing links
    if (allCombos.length > 0) {
      const { error: insertError } = await supabase
        .from("clinic_insurances")
        .insert(allCombos);

      if (insertError) {
        // Handle duplicate errors gracefully
        if (insertError.code === "23505") {
          console.log("Some links already existed, ignoring duplicates");
        } else {
          result.errors.push(`Insert error: ${insertError.message}`);
        }
      }
    }

    result.success = true;
    console.log(
      `[InsuranceSync] Created ${result.linksCreated} links, ${result.linksAlreadyExist} already existed`
    );
  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`);
  }

  return result;
}

/**
 * Get insurance assignment statistics
 */
export async function getInsuranceStats() {
  const { count: clinicCount } = await supabase
    .from("clinics")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: insuranceCount } = await supabase
    .from("insurances")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: linkCount } = await supabase
    .from("clinic_insurances")
    .select("*", { count: "exact", head: true });

  const expectedLinks = (clinicCount || 0) * (insuranceCount || 0);

  return {
    totalClinics: clinicCount || 0,
    totalInsurances: insuranceCount || 0,
    totalLinks: linkCount || 0,
    expectedLinks,
    missingLinks: expectedLinks - (linkCount || 0),
    isFullyLinked: (linkCount || 0) >= expectedLinks,
  };
}