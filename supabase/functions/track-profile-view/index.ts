import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema with strict limits
const TrackRequestSchema = z.object({
  clinicId: z.string().uuid().optional().nullable(),
  dentistId: z.string().uuid().optional().nullable(),
  eventType: z.enum(["view", "click", "booking_start", "booking_complete", "call", "direction", "website"]),
  source: z.string().max(100).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable().refine(
    (data) => !data || JSON.stringify(data).length < 1024,
    { message: "Metadata too large (max 1KB)" }
  ),
});

type TrackRequest = z.infer<typeof TrackRequestSchema>;

// Rate limiting constants
const RATE_LIMIT_MAX_REQUESTS = 20; // Max requests per window
const RATE_LIMIT_WINDOW_MINUTES = 1; // Time window in minutes

// Simple in-memory rate limiting (per-instance, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    // New window or expired
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Cleanup old entries periodically (prevent memory leak)
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

// Simple hash function for privacy
async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "salt_for_privacy");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check request size limit (10KB max)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10240) {
      return new Response(
        JSON.stringify({ error: "Request too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP for rate limiting
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    const ipHash = await hashIp(ip);

    // Apply rate limiting
    if (!checkRateLimit(ipHash)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cleanup old rate limit entries occasionally (1% chance per request)
    if (Math.random() < 0.01) {
      cleanupRateLimitMap();
    }

    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parseResult = TrackRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clinicId, dentistId, eventType, source, metadata }: TrackRequest = parseResult.data;

    if (!clinicId && !dentistId) {
      return new Response(
        JSON.stringify({ error: "Either clinicId or dentistId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user agent from request headers
    const userAgent = req.headers.get("user-agent") || "";

    // Insert analytics event
    const { error } = await supabase.from("profile_analytics").insert({
      clinic_id: clinicId || null,
      dentist_id: dentistId || null,
      event_type: eventType,
      source: source || null,
      user_agent: userAgent.substring(0, 500), // Limit user agent length
      ip_hash: ipHash,
      metadata: metadata || {}
    });

    if (error) {
      console.error("Failed to track event:", error);
      return new Response(
        JSON.stringify({ error: "Failed to track event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Track profile view error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
