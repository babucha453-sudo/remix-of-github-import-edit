import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('API test attempt without authentication');
      return new Response(
        JSON.stringify({ status: 'error', message: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('API test attempt with invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ status: 'error', message: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify super_admin role
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Error checking user roles:', rolesError.message);
      return new Response(
        JSON.stringify({ status: 'error', message: 'Authorization check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) {
      console.error(`API test attempt by non-admin user: ${user.id}`);
      return new Response(
        JSON.stringify({ status: 'error', message: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`API test authorized for super_admin: ${user.id}`);
    
    const { api, ...credentials } = await req.json();
    
    let result = { status: 'ok', message: 'API test successful' };
    
    switch (api) {
      case 'aimlapi':
      case 'gemini':
      case 'lovable_ai': {
        // Use AIMLAPI as the primary AI gateway
        const AIMLAPI_KEY = Deno.env.get('AIMLAPI_KEY');
        
        if (!AIMLAPI_KEY) {
          result = { 
            status: 'error', 
            message: 'AIMLAPI_KEY not configured. Please add your AI/ML API key in secrets.' 
          };
          break;
        }
        
        // Test AIMLAPI with a simple request
        const response = await fetch(
          'https://api.aimlapi.com/v1/chat/completions',
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${AIMLAPI_KEY}`
            },
            body: JSON.stringify({
              model: 'gemini-2.0-flash',
              messages: [{ role: 'user', content: 'Say OK' }],
              max_tokens: 10,
            }),
          }
        );
        
        if (response.ok) {
          result = { status: 'ok', message: 'AI/ML API Gateway is working (Gemini via AIMLAPI)' };
        } else if (response.status === 429) {
          result = { 
            status: 'rate_limited', 
            message: 'AI/ML API rate limits exceeded. Please try again later.' 
          };
        } else if (response.status === 402) {
          result = { 
            status: 'error', 
            message: 'AI/ML API credits exhausted. Please add more credits.' 
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          result = { 
            status: 'error', 
            message: errorData.error?.message || `HTTP ${response.status}` 
          };
        }
        break;
      }
      
      case 'twilio': {
        const { account_sid, auth_token } = credentials;
        if (!account_sid || !auth_token) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Account SID and Auth Token are required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Test Twilio API by fetching account info
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`,
          {
            headers: {
              'Authorization': 'Basic ' + btoa(`${account_sid}:${auth_token}`),
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          result = { 
            status: 'ok', 
            message: `Twilio connected: ${data.friendly_name || data.sid}` 
          };
        } else {
          result = { 
            status: 'error', 
            message: `Twilio auth failed: HTTP ${response.status}` 
          };
        }
        break;
      }
      
      case 'resend': {
        // Test Resend API by checking account info
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        
        if (!RESEND_API_KEY) {
          result = { 
            status: 'error', 
            message: 'RESEND_API_KEY not configured. Please add your Resend API key in secrets.' 
          };
          break;
        }
        
        // Test Resend API by fetching domains
        const response = await fetch('https://api.resend.com/domains', {
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const domainCount = data?.data?.length || 0;
          result = { 
            status: 'ok', 
            message: `Resend connected (${domainCount} domain${domainCount !== 1 ? 's' : ''} configured)` 
          };
        } else if (response.status === 401) {
          result = { 
            status: 'error', 
            message: 'Invalid Resend API key' 
          };
        } else if (response.status === 429) {
          result = { 
            status: 'rate_limited', 
            message: 'Resend rate limit reached' 
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          result = { 
            status: 'error', 
            message: errorData.message || `HTTP ${response.status}` 
          };
        }
        break;
      }
      
      case 'smtp': {
        // SMTP requires actual connection test which is complex in edge function
        // Return configured status
        result = { 
          status: 'ok', 
          message: 'SMTP settings saved. Send test email to verify.' 
        };
        break;
      }
      
      case 'whatsapp': {
        const { access_token, phone_number_id } = credentials;
        if (!access_token || !phone_number_id) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Access token and phone number ID required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${phone_number_id}`,
          {
            headers: { 'Authorization': `Bearer ${access_token}` },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          result = { 
            status: 'ok', 
            message: `WhatsApp connected: ${data.display_phone_number || 'OK'}` 
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          result = { 
            status: 'error', 
            message: errorData.error?.message || `HTTP ${response.status}` 
          };
        }
        break;
      }
      
      case 'google_places': {
        const { api_key } = credentials;
        if (!api_key) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'API key is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Test Places API with a simple request
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=${api_key}`
        );
        
        const data = await response.json();
        
        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          result = { status: 'ok', message: 'Google Places API is working' };
        } else if (data.status === 'REQUEST_DENIED') {
          result = { 
            status: 'error', 
            message: data.error_message || 'API key is invalid or restricted' 
          };
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          result = { status: 'rate_limited', message: 'API quota exceeded' };
        } else {
          result = { 
            status: 'error', 
            message: data.error_message || `Status: ${data.status}` 
          };
        }
        break;
      }
      
      case 'stripe': {
        const { api_key } = credentials;
        if (!api_key) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Secret key is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Test Stripe API by fetching account info
        const response = await fetch(
          'https://api.stripe.com/v1/account',
          {
            headers: {
              'Authorization': `Bearer ${api_key}`,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          result = { 
            status: 'ok', 
            message: `Stripe connected: ${data.business_profile?.name || data.id}` 
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          result = { 
            status: 'error', 
            message: errorData.error?.message || `HTTP ${response.status}` 
          };
        }
        break;
      }
      
      default:
        result = { status: 'ok', message: 'Configuration saved' };
    }
    
    console.log(`API test for ${api}:`, result);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Test API error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
