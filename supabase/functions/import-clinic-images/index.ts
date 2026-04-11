import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseCsvLine(line: string, delimiter = ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
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

    const { action = 'import', storagePath, bucket = 'clinic-assets', batchSize = 300, skipRows = 0, maxRows = 10000 } = await req.json();

    // Action 1: Build and store mapping
    if (action === 'build-mapping') {
      console.log('Building clinic ID mapping...');
      
      // Get current clinic slugs -> ids
      const clinicSlugToId = new Map<string, string>();
      let from = 0;
      while (true) {
        const { data } = await supabase.from('clinics').select('id, slug').range(from, from + 999);
        for (const c of data || []) clinicSlugToId.set(c.slug, c.id);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      console.log(`Loaded ${clinicSlugToId.size} current clinic slugs`);

      // Read clinics export to get old_id -> slug mapping
      const { data: clinicsFile } = await supabase.storage.from(bucket).download('imports/clinics-export.csv.gz');
      if (!clinicsFile) {
        return new Response(JSON.stringify({ error: 'clinics-export.csv.gz not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ds = new DecompressionStream('gzip');
      const reader = clinicsFile.stream().pipeThrough(ds).pipeThrough(new TextDecoderStream()).getReader();
      
      const mapping: Record<string, string> = {};
      let buf = '';
      let headers: string[] | null = null;
      let delim = ',';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          if (!headers) {
            const sc = t.split(';').length;
            const cc = t.split(',').length;
            delim = sc > cc ? ';' : ',';
            headers = parseCsvLine(t, delim);
            continue;
          }
          const vals = parseCsvLine(t, delim);
          const idIdx = headers.indexOf('id');
          const slugIdx = headers.indexOf('slug');
          if (idIdx >= 0 && slugIdx >= 0 && vals.length > Math.max(idIdx, slugIdx)) {
            const oldId = vals[idIdx];
            const slug = vals[slugIdx];
            const newId = clinicSlugToId.get(slug);
            if (newId) mapping[oldId] = newId;
          }
        }
      }

      // Store mapping in global_settings
      await supabase.from('global_settings').upsert({
        key: 'clinic_id_mapping',
        value: mapping,
      }, { onConflict: 'key' });

      const remapCount = Object.entries(mapping).filter(([k, v]) => k !== v).length;
      console.log(`Stored mapping: ${Object.keys(mapping).length} entries, ${remapCount} need remapping`);

      return new Response(JSON.stringify({
        success: true,
        total_mappings: Object.keys(mapping).length,
        remapped: remapCount,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Action 2: Import clinic_images using stored mapping
    console.log('Loading clinic ID mapping from DB...');
    const { data: mappingData } = await supabase.from('global_settings').select('value').eq('key', 'clinic_id_mapping').single();
    const idMapping: Record<string, string> = (mappingData?.value as Record<string, string>) || {};
    console.log(`Loaded ${Object.keys(idMapping).length} ID mappings`);

    if (!storagePath) {
      return new Response(JSON.stringify({ error: 'storagePath required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(storagePath);
    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: `Download failed: ${downloadError?.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Downloaded ${fileData.size} bytes, importing clinic_images (skip=${skipRows}, max=${maxRows})...`);

    const stream = fileData.stream().pipeThrough(new TextDecoderStream());
    const reader = stream.getReader();
    
    let headers: string[] | null = null;
    let delimiter = ';';
    let buffer = '';
    let imported = 0;
    let errors = 0;
    let totalLines = 0;
    let skippedLines = 0;
    let remapped = 0;
    let noMapping = 0;
    let batch: Record<string, any>[] = [];
    const errorDetails: string[] = [];

    async function flushBatch() {
      if (batch.length === 0) return;
      const toInsert = batch;
      batch = [];
      const { error } = await supabase.from('clinic_images').upsert(toInsert, {
        onConflict: 'id',
        ignoreDuplicates: true,
      });
      if (error) {
        errors += toInsert.length;
        if (errorDetails.length < 5) errorDetails.push(error.message);
      } else {
        imported += toInsert.length;
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!headers) {
          const sc = trimmed.split(';').length;
          const cc = trimmed.split(',').length;
          delimiter = sc > cc ? ';' : ',';
          headers = parseCsvLine(trimmed, delimiter);
          console.log(`Headers: ${headers.join(', ')}`);
          continue;
        }
        totalLines++;
        if (totalLines <= skipRows) { skippedLines++; continue; }
        if (maxRows > 0 && (totalLines - skipRows) > maxRows) break;

        const values = parseCsvLine(trimmed, delimiter);
        if (values.length !== headers.length) continue;

        const row: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          const val = values[j];
          row[headers[j]] = (val === '' || val === 'null') ? null : val;
        }

        // Remap clinic_id
        if (row.clinic_id) {
          const newId = idMapping[row.clinic_id];
          if (newId) {
            if (newId !== row.clinic_id) remapped++;
            row.clinic_id = newId;
          } else {
            noMapping++;
            continue;
          }
        }

        if (row.display_order) row.display_order = parseInt(row.display_order) || 0;

        batch.push(row);
        if (batch.length >= batchSize) {
          await flushBatch();
          if ((totalLines - skipRows) % 5000 === 0) {
            console.log(`Progress: ${totalLines} rows, ${imported} imported, ${remapped} remapped, ${noMapping} no-mapping`);
          }
        }
      }
    }

    if (buffer.trim() && headers) {
      totalLines++;
      const values = parseCsvLine(buffer.trim(), delimiter);
      if (values.length === headers.length) {
        const row: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          const val = values[j];
          row[headers[j]] = (val === '' || val === 'null') ? null : val;
        }
        if (row.clinic_id && idMapping[row.clinic_id]) {
          row.clinic_id = idMapping[row.clinic_id];
          if (row.display_order) row.display_order = parseInt(row.display_order) || 0;
          batch.push(row);
        }
      }
    }
    await flushBatch();

    console.log(`Done: ${totalLines} total, ${imported} imported, ${remapped} remapped, ${noMapping} no-mapping, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      total_lines: totalLines,
      skipped: skippedLines,
      imported,
      remapped,
      no_mapping: noMapping,
      errors,
      error_details: errorDetails,
      next_skip: totalLines,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
