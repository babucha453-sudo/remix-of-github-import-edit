import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting constants
const RATE_LIMIT_MAX_REQUESTS = 30; // Max requests per window
const RATE_LIMIT_WINDOW_MINUTES = 1; // Time window in minutes

// Simple in-memory rate limiting (per-instance, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Cleanup old entries periodically
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

// Input validation schemas
const MetadataSchema = z.record(z.unknown()).optional().refine(
  (data) => !data || JSON.stringify(data).length < 2048,
  { message: 'Metadata too large (max 2KB)' }
);

const SessionDataSchema = z.object({
  fingerprint: z.string().max(100).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  utmSource: z.string().max(100).optional().nullable(),
  utmMedium: z.string().max(100).optional().nullable(),
  utmCampaign: z.string().max(100).optional().nullable(),
  landingPage: z.string().max(500).optional().nullable(),
  totalPageviews: z.number().int().min(0).max(10000).optional(),
  totalEvents: z.number().int().min(0).max(10000).optional(),
  sessionDuration: z.number().int().min(0).max(86400).optional(),
  country: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
});

const PageviewDataSchema = z.object({
  pagePath: z.string().max(500),
  pageTitle: z.string().max(200).optional().nullable(),
  pageType: z.string().max(50).optional().nullable(),
  clinicId: z.string().uuid().optional().nullable(),
  dentistId: z.string().uuid().optional().nullable(),
  citySlug: z.string().max(100).optional().nullable(),
  stateSlug: z.string().max(100).optional().nullable(),
  treatmentSlug: z.string().max(100).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  timeOnPage: z.number().int().min(0).max(86400).optional().nullable(),
  scrollDepth: z.number().int().min(0).max(100).optional().nullable(),
  exitPage: z.boolean().optional(),
});

const EventDataSchema = z.object({
  eventType: z.string().max(50),
  eventCategory: z.string().max(50).optional().nullable(),
  pagePath: z.string().max(500).optional().nullable(),
  elementId: z.string().max(100).optional().nullable(),
  elementClass: z.string().max(200).optional().nullable(),
  elementText: z.string().max(200).optional().nullable(),
  clinicId: z.string().uuid().optional().nullable(),
  dentistId: z.string().uuid().optional().nullable(),
  metadata: MetadataSchema,
});

const JourneyDataSchema = z.object({
  stage: z.string().max(50),
  pagePath: z.string().max(500),
  clinicId: z.string().uuid().optional().nullable(),
  dentistId: z.string().uuid().optional().nullable(),
  stepNumber: z.number().int().min(1).max(100).optional(),
  converted: z.boolean().optional(),
  appointmentId: z.string().uuid().optional().nullable(),
});

const LinkPatientDataSchema = z.object({
  patientName: z.string().max(200).optional().nullable(),
  patientEmail: z.string().email().max(255).optional().nullable(),
  patientPhone: z.string().max(30).optional().nullable(),
  patientId: z.string().uuid().optional().nullable(),
});

const TrackRequestSchema = z.object({
  type: z.enum(['session', 'pageview', 'event', 'journey', 'link-patient']),
  sessionId: z.string().min(1).max(100),
  data: z.record(z.unknown()),
});

// Simple device detection
function parseUserAgent(ua: string): { deviceType: string; browser: string; os: string } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
  
  let browser = 'Unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  return { deviceType, browser, os };
}

// Check if likely a bot
function isBot(ua: string): boolean {
  const botPatterns = /bot|crawler|spider|scraper|headless|phantom|selenium|puppeteer/i;
  return botPatterns.test(ua);
}

// Hash IP for privacy
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'analytics-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check request size limit (20KB max)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 20480) {
      return new Response(
        JSON.stringify({ error: 'Request too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get IP for rate limiting
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
    const ipHash = await hashIP(forwardedFor);

    // Apply rate limiting
    if (!checkRateLimit(ipHash)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cleanup old rate limit entries occasionally (1% chance per request)
    if (Math.random() < 0.01) {
      cleanupRateLimitMap();
    }

    // Parse and validate base request
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseParseResult = TrackRequestSchema.safeParse(rawBody);
    if (!baseParseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: baseParseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, sessionId, data } = baseParseResult.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userAgent = req.headers.get('user-agent') || '';
    const { deviceType, browser, os } = parseUserAgent(userAgent);
    const isBotVisitor = isBot(userAgent);

    // Get geo data from Cloudflare headers if available
    const country = req.headers.get('cf-ipcountry') || (data as any).country || null;
    const city = req.headers.get('cf-ipcity') || (data as any).city || null;
    const region = req.headers.get('cf-region') || (data as any).region || null;

    if (type === 'session') {
      // Validate session data
      const sessionDataResult = SessionDataSchema.safeParse(data);
      if (!sessionDataResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid session data', details: sessionDataResult.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const sessionData = sessionDataResult.data;

      // Create or update session
      const { data: existingSession } = await supabase
        .from('visitor_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      if (existingSession) {
        // Update last seen
        await supabase
          .from('visitor_sessions')
          .update({
            last_seen_at: new Date().toISOString(),
            total_pageviews: sessionData.totalPageviews || 0,
            total_events: sessionData.totalEvents || 0,
            session_duration_seconds: sessionData.sessionDuration || 0,
          })
          .eq('session_id', sessionId);

        return new Response(
          JSON.stringify({ success: true, sessionId: existingSession.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create new session
      const { data: newSession, error: sessionError } = await supabase
        .from('visitor_sessions')
        .insert({
          session_id: sessionId,
          visitor_fingerprint: sessionData.fingerprint || null,
          ip_hash: ipHash,
          user_agent: userAgent.substring(0, 500),
          device_type: deviceType,
          browser,
          os,
          country,
          country_code: country,
          region,
          city,
          referrer: sessionData.referrer || null,
          utm_source: sessionData.utmSource || null,
          utm_medium: sessionData.utmMedium || null,
          utm_campaign: sessionData.utmCampaign || null,
          landing_page: sessionData.landingPage || null,
          is_bot: isBotVisitor,
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      return new Response(
        JSON.stringify({ success: true, sessionId: newSession?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'pageview') {
      // Validate pageview data
      const pvDataResult = PageviewDataSchema.safeParse(data);
      if (!pvDataResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid pageview data', details: pvDataResult.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const pvData = pvDataResult.data;

      // Get visitor session id
      const { data: session } = await supabase
        .from('visitor_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      const { error: pvError } = await supabase
        .from('page_views')
        .insert({
          session_id: sessionId,
          visitor_session_id: session?.id || null,
          page_path: pvData.pagePath,
          page_title: pvData.pageTitle || null,
          page_type: pvData.pageType || null,
          clinic_id: pvData.clinicId || null,
          dentist_id: pvData.dentistId || null,
          city_slug: pvData.citySlug || null,
          state_slug: pvData.stateSlug || null,
          treatment_slug: pvData.treatmentSlug || null,
          referrer: pvData.referrer || null,
          time_on_page_seconds: pvData.timeOnPage || null,
          scroll_depth_percent: pvData.scrollDepth || null,
          exit_page: pvData.exitPage || false,
        });

      if (pvError) throw pvError;

      // Update session pageview count (ignore errors if RPC doesn't exist)
      try {
        await supabase.rpc('increment_session_pageviews', { p_session_id: sessionId });
      } catch {
        await supabase
          .from('visitor_sessions')
          .update({
            last_seen_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'event') {
      // Validate event data
      const evDataResult = EventDataSchema.safeParse(data);
      if (!evDataResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid event data', details: evDataResult.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const evData = evDataResult.data;

      const { data: session } = await supabase
        .from('visitor_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      const { error: evError } = await supabase
        .from('visitor_events')
        .insert({
          session_id: sessionId,
          visitor_session_id: session?.id || null,
          event_type: evData.eventType,
          event_category: evData.eventCategory || null,
          page_path: evData.pagePath || null,
          element_id: evData.elementId || null,
          element_class: evData.elementClass || null,
          element_text: evData.elementText || null,
          clinic_id: evData.clinicId || null,
          dentist_id: evData.dentistId || null,
          metadata: evData.metadata || {},
        });

      if (evError) throw evError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'journey') {
      // Validate journey data
      const jDataResult = JourneyDataSchema.safeParse(data);
      if (!jDataResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid journey data', details: jDataResult.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const jData = jDataResult.data;

      const { data: session } = await supabase
        .from('visitor_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      const { error: jError } = await supabase
        .from('visitor_journeys')
        .insert({
          session_id: sessionId,
          visitor_session_id: session?.id || null,
          journey_stage: jData.stage,
          page_path: jData.pagePath,
          clinic_id: jData.clinicId || null,
          dentist_id: jData.dentistId || null,
          step_number: jData.stepNumber || 1,
          converted: jData.converted || false,
          appointment_id: jData.appointmentId || null,
        });

      if (jError) throw jError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link session to patient after booking
    if (type === 'link-patient') {
      // Validate link-patient data
      const lpDataResult = LinkPatientDataSchema.safeParse(data);
      if (!lpDataResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid link-patient data', details: lpDataResult.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const lpData = lpDataResult.data;

      const { error: linkError } = await supabase
        .from('visitor_sessions')
        .update({
          patient_name: lpData.patientName,
          patient_email: lpData.patientEmail,
          patient_phone: lpData.patientPhone,
          patient_id: lpData.patientId || null,
          linked_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (linkError) throw linkError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Track visitor error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
