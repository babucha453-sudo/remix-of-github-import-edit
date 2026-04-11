import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email extraction regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Filter out non-business emails
function filterEmails(emails: string[]): string[] {
  return emails.filter(email => {
    const lower = email.toLowerCase();
    // Skip image files, example emails, etc
    if (lower.includes('.png') || lower.includes('.jpg') || lower.includes('.gif')) return false;
    if (lower.includes('example.com') || lower.includes('test.com')) return false;
    if (lower.includes('sentry.io') || lower.includes('wixpress.com')) return false;
    if (lower.includes('wordpress.com') || lower.includes('googleapis.com')) return false;
    return true;
  });
}

// Prioritize business emails
function prioritizeEmails(emails: string[]): string[] {
  const priority: { [key: string]: number } = {
    'contact': 1,
    'info': 2,
    'hello': 3,
    'appointments': 4,
    'booking': 5,
    'office': 6,
    'front': 7,
    'reception': 8,
    'admin': 9,
    'dental': 10,
    'support': 15,
    'noreply': 99,
    'no-reply': 99,
  };

  return [...new Set(emails)].sort((a, b) => {
    const aPrefix = a.split('@')[0].toLowerCase();
    const bPrefix = b.split('@')[0].toLowerCase();
    
    let aPriority = 50;
    let bPriority = 50;
    
    for (const [key, val] of Object.entries(priority)) {
      if (aPrefix.includes(key)) aPriority = Math.min(aPriority, val);
      if (bPrefix.includes(key)) bPriority = Math.min(bPriority, val);
    }
    
    return aPriority - bPriority;
  });
}

// Extract emails from content
function extractEmails(content: string): string[] {
  const matches = content.match(EMAIL_REGEX) || [];
  return filterEmails(matches);
}

// Validate email matches website domain
function validateEmailDomain(email: string, websiteUrl: string): boolean {
  try {
    const emailDomain = email.split('@')[1].toLowerCase();
    const websiteDomain = new URL(websiteUrl).hostname.replace('www.', '').toLowerCase();
    
    // Exact match or subdomain
    return emailDomain === websiteDomain || emailDomain.endsWith('.' + websiteDomain);
  } catch {
    return false;
  }
}

// Note: Background processing was removed as EdgeRuntime.waitUntil is unreliable.
// Processing is now handled by the frontend calling process-batch repeatedly.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    // Check if Firecrawl is configured
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Firecrawl API key not configured',
          requiresSetup: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Start a new session and process in background
    if (action === 'start-session') {
      const { stateId, cityId, cityIds, userId } = body;

      // Build query for clinics to process
      let countQuery = supabase
        .from('clinics')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_duplicate', false)
        .not('website', 'is', null)
        .is('email', null);

      if (cityId) {
        countQuery = countQuery.eq('city_id', cityId);
      } else if (cityIds && cityIds.length > 0) {
        countQuery = countQuery.in('city_id', cityIds);
      }

      const { count: totalCount } = await countQuery;

      if (!totalCount || totalCount === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No clinics found that need email enrichment' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch all clinic IDs in batches
      let allClinics: { id: string }[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (offset < totalCount) {
        let batchQuery = supabase
          .from('clinics')
          .select('id')
          .eq('is_active', true)
          .eq('is_duplicate', false)
          .not('website', 'is', null)
          .is('email', null)
          .range(offset, offset + batchSize - 1);

        if (cityId) {
          batchQuery = batchQuery.eq('city_id', cityId);
        } else if (cityIds && cityIds.length > 0) {
          batchQuery = batchQuery.in('city_id', cityIds);
        }

        const { data: batch } = await batchQuery;
        if (batch) allClinics = [...allClinics, ...batch];
        offset += batchSize;
      }

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('email_enrichment_sessions')
        .insert({
          state_id: stateId,
          city_id: cityId,
          status: 'running',
          total_to_process: allClinics.length,
          started_at: new Date().toISOString(),
          created_by: userId,
        })
        .select()
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create result records for each clinic in batches
      const resultRecords = allClinics.map(c => ({
        session_id: session.id,
        clinic_id: c.id,
        status: 'pending',
      }));

      for (let i = 0; i < resultRecords.length; i += 500) {
        const batch = resultRecords.slice(i, i + 500);
        await supabase.from('email_enrichment_results').insert(batch);
      }

      // Return immediately - frontend will handle processing via process-batch calls
      return new Response(
        JSON.stringify({
          success: true, 
          sessionId: session.id,
          totalClinics: allClinics.length,
          message: 'Session started, processing in background'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Scrape a single clinic
    if (action === 'scrape-single') {
      const { clinicId } = body;
      
      if (!clinicId) {
        return new Response(
          JSON.stringify({ success: false, error: 'clinicId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get clinic
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .select('id, name, website, email, phone, address')
        .eq('id', clinicId)
        .single();

      if (clinicError || !clinic) {
        return new Response(
          JSON.stringify({ success: false, error: 'Clinic not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!clinic.website) {
        return new Response(
          JSON.stringify({ success: false, error: 'Clinic has no website' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Scrape the website
      console.log('Scraping:', clinic.website);
      
      const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: clinic.website,
          formats: ['markdown', 'html', 'links'],
          onlyMainContent: false,
        }),
      });

      const scrapeData = await scrapeResponse.json();

      if (!scrapeResponse.ok) {
        console.error('Scrape failed:', scrapeData);
        return new Response(
          JSON.stringify({ success: false, error: scrapeData.error || 'Scrape failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract emails from content
      const content = (scrapeData.data?.markdown || '') + ' ' + (scrapeData.data?.html || '');
      const allEmails = extractEmails(content);
      const prioritized = prioritizeEmails(allEmails);
      
      // Validate domain match
      const validEmails = prioritized.filter(email => 
        validateEmailDomain(email, clinic.website)
      );
      
      // Also keep other emails but mark them
      const otherEmails = prioritized.filter(email => 
        !validateEmailDomain(email, clinic.website)
      );

      // Find contact pages from links
      const links = scrapeData.data?.links || [];
      const contactPages = links.filter((link: string) => 
        /contact|about|team|staff/i.test(link)
      ).slice(0, 3);

      const result = {
        clinic_id: clinicId,
        clinic_name: clinic.name,
        website: clinic.website,
        emails_found: [...validEmails, ...otherEmails],
        domain_matched_emails: validEmails,
        other_emails: otherEmails,
        email_selected: validEmails[0] || prioritized[0] || null,
        contact_pages: contactPages,
        match_confidence: validEmails.length > 0 ? 95 : (prioritized.length > 0 ? 70 : 0),
      };

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Process batch for a session (legacy - kept for compatibility)
    if (action === 'process-batch') {
      const { sessionId, batchSize = 10 } = body;
      
      if (!sessionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'sessionId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get pending clinics for this session
      const { data: pendingResults, error: pendingError } = await supabase
        .from('email_enrichment_results')
        .select('id, clinic_id, clinic:clinics(id, name, website, email)')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .limit(batchSize);

      if (pendingError) {
        return new Response(
          JSON.stringify({ success: false, error: pendingError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!pendingResults || pendingResults.length === 0) {
        // Update session as completed
        await supabase
          .from('email_enrichment_sessions')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', sessionId);

        return new Response(
          JSON.stringify({ success: true, processed: 0, message: 'No pending items' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let successCount = 0;
      let failedCount = 0;
      let noEmailCount = 0;
      let processed = 0;

      // If Firecrawl is rate-limiting us, recommend the frontend to pause and retry later.
      let pauseRecommended = false;
      let pauseReason: string | null = null;
      let retryAfterSeconds: number | null = null;

      const results: any[] = [];

      const extractRetryAfterSeconds = (message: string): number | null => {
        const match = message.match(/retry after (\d+)s/i);
        if (match?.[1]) {
          const n = Number(match[1]);
          return Number.isFinite(n) ? n : null;
        }
        return null;
      };

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // Keep within typical Firecrawl free-tier limits (~20 req/min)
      const THROTTLE_MS = 3500;

      for (const item of pendingResults) {
        const clinic = item.clinic as any;

        // Skip if no website
        if (!clinic?.website) {
          await supabase
            .from('email_enrichment_results')
            .update({
              status: 'skipped',
              error_message: 'No website URL',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          results.push({
            clinic_id: clinic?.id ?? item.clinic_id,
            name: clinic?.name ?? 'Unknown',
            status: 'skipped',
            error: 'No website URL',
          });
          processed++;
          continue;
        }

        // Mark as processing
        await supabase
          .from('email_enrichment_results')
          .update({ status: 'processing' })
          .eq('id', item.id);

        processed++;

        try {
          // Scrape website
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: clinic.website,
              formats: ['markdown', 'html'],
              onlyMainContent: false,
            }),
          });

          const scrapeText = await scrapeResponse.text();
          let scrapeData: any = {};
          try {
            scrapeData = JSON.parse(scrapeText);
          } catch {
            scrapeData = { error: (scrapeText || '').slice(0, 500) };
          }

          if (!scrapeResponse.ok) {
            const apiMsg =
              scrapeData?.error ||
              scrapeData?.message ||
              (typeof scrapeText === 'string' ? scrapeText.slice(0, 500) : '') ||
              'Scrape failed';

            const fullMsg = `Firecrawl ${scrapeResponse.status}: ${apiMsg}`;

            // If rate-limited (429) or insufficient credits (402), stop and let frontend know
            if (scrapeResponse.status === 429 || scrapeResponse.status === 402) {
              pauseRecommended = true;
              pauseReason = scrapeResponse.status === 402 
                ? 'Firecrawl API credits exhausted. Please upgrade your plan at firecrawl.dev/pricing'
                : apiMsg;
              retryAfterSeconds = scrapeResponse.status === 402 ? null : extractRetryAfterSeconds(apiMsg);

              await supabase
                .from('email_enrichment_results')
                .update({
                  status: 'pending',
                  error_message: fullMsg,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.id);

              results.push({
                clinic_id: clinic.id,
                name: clinic.name,
                website: clinic.website,
                status: scrapeResponse.status === 402 ? 'credits_exhausted' : 'rate_limited',
                error: fullMsg,
                retryAfterSeconds,
                creditsExhausted: scrapeResponse.status === 402,
              });

              // Stop processing this batch; frontend should retry later.
              break;
            }

            throw new Error(fullMsg);
          }

          // Extract emails
          const content = (scrapeData.data?.markdown || '') + ' ' + (scrapeData.data?.html || '');
          const allEmails = extractEmails(content);
          const prioritized = prioritizeEmails(allEmails);

          const validEmails = prioritized.filter((email) => validateEmailDomain(email, clinic.website));

          const selectedEmail = validEmails[0] || prioritized[0] || null;
          const confidence = validEmails.length > 0 ? 95 : prioritized.length > 0 ? 70 : 0;

          // Update result
          await supabase
            .from('email_enrichment_results')
            .update({
              website_url: clinic.website,
              emails_found: prioritized,
              email_selected: selectedEmail,
              match_confidence: confidence,
              match_method: validEmails.length > 0 ? 'domain_match' : 'extracted',
              status: selectedEmail ? 'success' : 'no_email',
              needs_review: confidence < 80 && selectedEmail !== null,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          if (selectedEmail) {
            successCount++;
          } else {
            noEmailCount++;
          }

          results.push({
            clinic_id: clinic.id,
            name: clinic.name,
            website: clinic.website,
            status: selectedEmail ? 'success' : 'no_email',
            email: selectedEmail,
            confidence,
            emails: prioritized.slice(0, 5),
          });

          // Throttle between requests
          await sleep(THROTTLE_MS);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Error processing ${clinic.name}:`, err);

          await supabase
            .from('email_enrichment_results')
            .update({
              status: 'failed',
              error_message: errMsg,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          results.push({
            clinic_id: clinic.id,
            name: clinic.name,
            website: clinic.website,
            status: 'failed',
            error: errMsg,
          });

          failedCount++;

          // Throttle between requests
          await sleep(THROTTLE_MS);
        }
      }

      // Update session stats
      const { data: sessionStats } = await supabase
        .from('email_enrichment_results')
        .select('status')
        .eq('session_id', sessionId);

      if (sessionStats) {
        const stats = {
          processed_count: sessionStats.filter((r: any) => r.status !== 'pending').length,
          success_count: sessionStats.filter((r: any) => r.status === 'success').length,
          failed_count: sessionStats.filter((r: any) => r.status === 'failed').length,
          skipped_count: sessionStats.filter((r: any) => r.status === 'skipped' || r.status === 'no_email').length,
        };

        await supabase.from('email_enrichment_sessions').update(stats).eq('id', sessionId);
      }

      if (pauseRecommended) {
        // Mark session paused so it reflects correctly even if user closes the tab.
        await supabase
          .from('email_enrichment_sessions')
          .update({ status: 'paused' })
          .eq('id', sessionId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed,
          successCount,
          failedCount,
          noEmailCount,
          results,
          pauseRecommended,
          pauseReason,
          retryAfterSeconds,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Apply email to clinic (stores ALL discovered emails for claim verification)
    if (action === 'apply-email') {
      const { resultId, email } = body;

      if (!resultId || !email) {
        return new Response(
          JSON.stringify({ success: false, error: 'resultId and email required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the result with all emails found
      const { data: result, error: resultError } = await supabase
        .from('email_enrichment_results')
        .select('clinic_id, emails_found')
        .eq('id', resultId)
        .single();

      if (resultError || !result) {
        return new Response(
          JSON.stringify({ success: false, error: 'Result not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get all discovered emails to add to claim_emails
      const allEmails = result.emails_found || [];
      
      // Update clinic with primary email AND add all emails to claim_emails for verification
      const { error: updateError } = await supabase
        .from('clinics')
        .update({ 
          email, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', result.clinic_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add all discovered emails to claim_emails array using the database function
      if (allEmails.length > 0) {
        await supabase.rpc('add_clinic_claim_emails', {
          p_clinic_id: result.clinic_id,
          p_emails: allEmails
        });
      }

      // Mark result as applied
      await supabase
        .from('email_enrichment_results')
        .update({ 
          applied_at: new Date().toISOString(),
          email_selected: email 
        })
        .eq('id', resultId);

      return new Response(
        JSON.stringify({ success: true, emailsAddedToClaim: allEmails.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Email enrichment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
