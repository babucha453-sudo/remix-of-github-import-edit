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

function parseValue(val: string, key: string): any {
  if (val === '' || val === 'null' || val === 'NULL') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;
  const numericFields = [
    'rank_score', 'total_reviews', 'average_rating', 'total_leads',
    'dentist_count', 'clinic_count', 'display_order', 'latitude', 'longitude',
    'population'
  ];
  if (numericFields.includes(key)) {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
    try { return JSON.parse(val); } catch { return val; }
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

    const { storagePath, table, bucket = 'clinic-assets', batchSize = 200, skipRows = 0, maxRows = 0, skipFkCheck = false } = await req.json();

    if (!storagePath || !table) {
      return new Response(JSON.stringify({ error: 'storagePath and table required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Downloading ${storagePath} from bucket ${bucket}... (skip=${skipRows}, max=${maxRows || 'all'})`);
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: `Download failed: ${downloadError?.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Downloaded ${fileData.size} bytes, streaming decompress + import...`);

    // Stream decompress and process line by line
    let stream: ReadableStream<Uint8Array>;
    if (storagePath.endsWith('.gz')) {
      const ds = new DecompressionStream('gzip');
      stream = fileData.stream().pipeThrough(ds);
    } else {
      stream = fileData.stream();
    }

    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    
    let headers: string[] | null = null;
    let delimiter = ';'; // will auto-detect
    let buffer = '';
    let imported = 0;
    let errors = 0;
    let parseErrors = 0;
    let totalLines = 0;
    let skippedLines = 0;
    let batch: Record<string, any>[] = [];
    const errorDetails: string[] = [];
    let multiLineBuffer = ''; // accumulate lines that are part of a multi-line quoted field
    // Pre-fetch valid FK IDs if needed
    let validClinicIds: Set<string> | null = null;
    if (!skipFkCheck && table !== 'clinics') {
      const allIds = new Set<string>();
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data } = await supabase.from('clinics').select('id').range(from, from + PAGE - 1);
        for (const c of data || []) allIds.add(c.id);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      validClinicIds = allIds;
      console.log(`Pre-fetched ${validClinicIds.size} valid clinic IDs for FK validation`);
    }

    let fkSkipped = 0;

    async function flushBatch() {
      if (batch.length === 0) return;
      let toInsert = batch;
      batch = [];
      
      // Filter out FK violations before inserting
      if (validClinicIds) {
        const valid = toInsert.filter(r => !r.clinic_id || validClinicIds!.has(r.clinic_id));
        fkSkipped += toInsert.length - valid.length;
        toInsert = valid;
        if (toInsert.length === 0) return;
      }
      
      const { error } = await supabase.from(table).upsert(toInsert, { 
        onConflict: 'id',
        ignoreDuplicates: true 
      });
      if (error) {
        errors += toInsert.length;
        if (errorDetails.length < 5) errorDetails.push(error.message);
        console.error(`Batch error: ${error.message}`);
      } else {
        imported += toInsert.length;
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete last line

      for (const line of lines) {
        // Handle multi-line quoted fields: if we have an open quote, keep accumulating
        if (multiLineBuffer) {
          multiLineBuffer += '\n' + line;
          // Check if quotes are now balanced
          const quoteCount = (multiLineBuffer.match(/"/g) || []).length;
          if (quoteCount % 2 !== 0) continue; // still inside a quoted field
          // Quotes balanced - process the complete record
        } else {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Check if this line has unbalanced quotes (start of multi-line field)
          const quoteCount = (trimmed.match(/"/g) || []).length;
          if (quoteCount % 2 !== 0) {
            multiLineBuffer = trimmed;
            continue;
          }
        }
        
        const completeLine = multiLineBuffer || line.trim();
        multiLineBuffer = '';
        
        if (!completeLine) continue;
        
        if (!headers) {
          // Auto-detect delimiter
          const semicolonCount = completeLine.split(';').length;
          const commaCount = completeLine.split(',').length;
          delimiter = semicolonCount > commaCount ? ';' : ',';
          headers = parseCsvLine(completeLine, delimiter);
          console.log(`Detected delimiter: '${delimiter}', Headers (${headers.length}): ${headers.join(', ')}`);
          continue;
        }
        
        totalLines++;
        
        // Skip rows for resumable imports
        if (totalLines <= skipRows) { skippedLines++; continue; }
        
        // Stop if we've hit maxRows
        if (maxRows > 0 && (totalLines - skipRows) > maxRows) break;
        
        const values = parseCsvLine(completeLine, delimiter);
        if (values.length !== headers.length) { parseErrors++; continue; }
        
        const row: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = parseValue(values[j], headers[j]);
        }
        batch.push(row);
        
        if (batch.length >= batchSize) {
          await flushBatch();
          if ((totalLines - skipRows) % 2000 === 0) {
            console.log(`Progress: ${totalLines} rows (skipped ${skippedLines}), ${imported} imported, ${errors} errors`);
          }
        }
      }
    }

    // Process remaining buffer (including any pending multi-line content)
    const finalLine = multiLineBuffer ? multiLineBuffer + '\n' + buffer.trim() : buffer.trim();
    if (finalLine && headers) {
      totalLines++;
      const values = parseCsvLine(finalLine, delimiter);
      if (values.length === headers.length) {
        const row: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = parseValue(values[j], headers[j]);
        }
        batch.push(row);
      }
    }
    await flushBatch();

    console.log(`Done: ${totalLines} total (skipped ${skippedLines}, fk_skipped ${fkSkipped}), ${imported} imported, ${errors} errors, ${parseErrors} parse errors`);

    return new Response(JSON.stringify({
      success: true,
      total_lines: totalLines,
      skipped: skippedLines,
      fk_skipped: fkSkipped,
      imported,
      errors,
      parse_errors: parseErrors,
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
