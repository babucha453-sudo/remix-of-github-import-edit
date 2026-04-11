import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables to migrate in dependency order (no FK deps first)
const MIGRATION_ORDER = [
  // Level 0: Standalone tables with no dependencies
  "countries",
  "states", 
  "insurances",
  "treatments",
  "subscription_plans",
  "blog_categories",
  "global_settings",
  "feature_flags",
  
  // Level 1: Depends on Level 0
  "cities",
  "plan_features",
  
  // Level 2: Depends on Level 1
  "areas",
  "seo_pages",
  
  // Level 3: Main business entities
  "clinics",
  
  // Level 4: Depends on clinics
  "dentists",
  "clinic_treatments",
  "clinic_insurances",
  "clinic_gallery",
  "dentist_settings",
  
  // Level 5: Transactional data
  "leads",
  "appointments",
  "patients",
  "reviews",
  "internal_reviews",
  "google_reviews",
  
  // Level 6: User-related
  "user_roles",
  "user_onboarding",
  "claim_requests",
  
  // Level 7: Content & logs
  "blog_posts",
  "blog_authors",
  "static_pages",
  "audit_logs",
  "visitor_sessions",
  "page_views",
  "visitor_events",
  
  // Level 8: Support & messaging
  "support_tickets",
  "ticket_messages",
  "conversations",
  "messages",
  
  // Level 9: Automation & config
  "automation_rules",
  "outreach_campaigns",
  "outreach_templates",
  "seo_bot_runs",
  "seo_metadata_history",
];

interface MigrationRequest {
  action: "start" | "resume" | "status" | "migrate-table" | "list-tables";
  tableName?: string;
  batchSize?: number;
  lastId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
    const cloudUrl = Deno.env.get("SUPABASE_URL");
    const cloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!externalUrl || !externalServiceKey) {
      throw new Error("External Supabase credentials not configured");
    }

    // Source: Lovable Cloud
    const cloudClient = createClient(cloudUrl!, cloudServiceKey!);
    
    // Destination: External Supabase
    const externalClient = createClient(externalUrl, externalServiceKey);

    const body: MigrationRequest = await req.json();
    const { action, tableName, batchSize = 50, lastId } = body;

    switch (action) {
      case "list-tables": {
        // Return the migration order
        return new Response(
          JSON.stringify({ 
            success: true, 
            tables: MIGRATION_ORDER,
            totalTables: MIGRATION_ORDER.length 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "migrate-table": {
        if (!tableName) {
          throw new Error("tableName is required");
        }

        // Fetch batch from Cloud with timeout handling
        let query = cloudClient
          .from(tableName)
          .select("*")
          .order("id", { ascending: true })
          .limit(batchSize);

        if (lastId) {
          query = query.gt("id", lastId);
        }

        const { data: records, error: fetchError } = await query;

        if (fetchError) {
          // Check if it's a "table doesn't exist" error
          if (fetchError.message?.includes("does not exist") || 
              fetchError.code === "42P01") {
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: `Table ${tableName} does not exist in source, skipping`,
                skipped: true,
                recordsProcessed: 0 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error(`Fetch error for ${tableName}: ${fetchError.message}`);
        }

        if (!records || records.length === 0) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `No more records in ${tableName}`,
              completed: true,
              recordsProcessed: 0 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Upsert into external Supabase (idempotent)
        const { error: insertError } = await externalClient
          .from(tableName)
          .upsert(records, { 
            onConflict: "id",
            ignoreDuplicates: false 
          });

        if (insertError) {
          // If table doesn't exist in destination, we need schema first
          if (insertError.message?.includes("does not exist") ||
              insertError.code === "42P01") {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Table ${tableName} does not exist in destination. Run schema migration first.`,
                needsSchema: true
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
          }
          throw new Error(`Insert error for ${tableName}: ${insertError.message}`);
        }

        const lastProcessedId = records[records.length - 1].id;
        const hasMore = records.length === batchSize;

        return new Response(
          JSON.stringify({ 
            success: true,
            tableName,
            recordsProcessed: records.length,
            lastProcessedId,
            hasMore,
            message: hasMore 
              ? `Migrated ${records.length} records, more available` 
              : `Migrated ${records.length} records, batch complete`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "status": {
        // Get count from both databases for comparison
        const results: Record<string, { cloud: number; external: number }> = {};
        
        for (const table of MIGRATION_ORDER.slice(0, 10)) { // Check first 10 tables
          try {
            const [cloudResult, externalResult] = await Promise.allSettled([
              cloudClient.from(table).select("id", { count: "exact", head: true }),
              externalClient.from(table).select("id", { count: "exact", head: true })
            ]);

            results[table] = {
              cloud: cloudResult.status === "fulfilled" ? (cloudResult.value.count ?? 0) : -1,
              external: externalResult.status === "fulfilled" ? (externalResult.value.count ?? 0) : -1
            };
          } catch {
            results[table] = { cloud: -1, external: -1 };
          }
        }

        return new Response(
          JSON.stringify({ success: true, comparison: results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: list-tables, migrate-table, status" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("Migration error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errMsg,
        retryable: errMsg?.includes("timeout") || errMsg?.includes("504")
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
