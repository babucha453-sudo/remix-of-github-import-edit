import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseCsvLine(line: string, delimiter = ';'): string[] {
  return line.split(delimiter).map(v => v.trim());
}

function parseValue(val: string, key: string): any {
  if (val === '' || val === 'null' || val === 'NULL') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;
  // Numeric fields
  const numericFields = ['min_advance_booking_hours', 'max_advance_booking_days', 'reminder_hours_before',
    'slot_duration_minutes', 'buffer_minutes', 'day_of_week', 'years_experience', 'rating', 'review_count'];
  if (numericFields.includes(key)) {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return val;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { table, csvData, skipFkCheck } = await req.json();

    if (!table || !csvData) {
      return new Response(JSON.stringify({ error: 'table and csvData required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lines = csvData.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: 'No data rows' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = parseCsvLine(lines[0]);
    console.log(`Importing ${lines.length - 1} rows into ${table}, columns: ${headers.join(', ')}`);

    // Get valid clinic IDs if we need FK checking
    let validClinicIds: Set<string> | null = null;
    if (!skipFkCheck && headers.includes('clinic_id')) {
      const allClinicIds = new Set<string>();
      let from = 0;
      const PAGE = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase.from('clinics').select('id').range(from, from + PAGE - 1);
        for (const c of data || []) allClinicIds.add(c.id);
        hasMore = (data?.length || 0) === PAGE;
        from += PAGE;
      }
      validClinicIds = allClinicIds;
      console.log(`Found ${validClinicIds.size} valid clinic IDs`);
    }

    // Parse rows
    const rows: Record<string, any>[] = [];
    let skippedFk = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = parseValue(values[j], headers[j]);
      }

      // Skip rows with invalid clinic_id FK
      if (validClinicIds && row.clinic_id && !validClinicIds.has(row.clinic_id)) {
        skippedFk++;
        continue;
      }

      // Skip rows with invalid dentist_id FK if applicable
      rows.push(row);
    }

    console.log(`Parsed ${rows.length} valid rows (${skippedFk} skipped due to missing clinic)`);

    // Batch insert
    const BATCH = 500;
    let imported = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
      if (error) {
        errors += batch.length;
        errorDetails.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
        console.error(`Batch error:`, error.message);
      } else {
        imported += batch.length;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_rows: lines.length - 1,
      imported,
      skipped_fk: skippedFk,
      errors,
      error_details: errorDetails.slice(0, 10),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
