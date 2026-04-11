import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to verify Meta webhook signature
async function verifyWebhookSignature(payload: string, signature: string | null, appSecret: string): Promise<boolean> {
  if (!signature) {
    console.error('No signature provided');
    return false;
  }
  
  // Meta sends signature as "sha256=<hash>"
  const expectedPrefix = 'sha256=';
  if (!signature.startsWith(expectedPrefix)) {
    console.error('Invalid signature format');
    return false;
  }
  
  const providedHash = signature.slice(expectedPrefix.length);
  
  // Create HMAC-SHA256 hash
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const data = encoder.encode(payload);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHash === providedHash;
}

// WhatsApp webhook for receiving incoming messages and status updates
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);

  // GET request - WhatsApp webhook verification
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    // Get verify token from environment variable first, fallback to settings
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'DUBAI_DENTAL_WHATSAPP_VERIFY';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WhatsApp webhook verified');
      return new Response(challenge, { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    } else {
      console.error('WhatsApp webhook verification failed');
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }
  }

  // POST request - incoming webhook events
  if (req.method === 'POST') {
    try {
      // Get the raw body for signature verification
      const rawBody = await req.text();
      
      // Verify Meta webhook signature - ALWAYS required for production
      const signature = req.headers.get('X-Hub-Signature-256');
      const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
      const isDevelopment = Deno.env.get('DENO_DEPLOYMENT_ID') === undefined;
      
      if (!appSecret) {
        // Block requests if secret is not configured - this is a critical security issue
        console.error('WHATSAPP_APP_SECRET not configured - rejecting all webhook requests');
        return new Response(
          JSON.stringify({ error: 'Webhook not configured - contact administrator' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.error('Invalid webhook signature - rejecting request');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Webhook signature verified successfully');
      
      // Parse the verified payload
      const body = JSON.parse(rawBody);
      console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));

      // Process each entry
      const entries = body.entry || [];
      
      for (const entry of entries) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          const value = change.value;
          
          // Handle incoming messages
          if (value.messages) {
            for (const message of value.messages) {
              await processIncomingMessage(supabase, message, value.metadata);
            }
          }
          
          // Handle message status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              await processStatusUpdate(supabase, status);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});

async function processIncomingMessage(supabase: any, message: any, metadata: any) {
  console.log('Processing incoming message:', message);
  
  const phoneNumber = message.from;
  const messageText = message.text?.body || '';
  const messageType = message.type;
  const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
  
  // Find clinic associated with this WhatsApp number
  const { data: crmNumber } = await supabase
    .from('crm_numbers')
    .select('clinic_id, clinic:clinics(id, name)')
    .eq('phone_number', metadata.display_phone_number)
    .eq('is_whatsapp_enabled', true)
    .single();

  // Store the incoming message
  const { data: storedMessage, error } = await supabase
    .from('clinic_messages')
    .insert({
      clinic_id: crmNumber?.clinic_id || null,
      direction: 'inbound',
      channel: 'whatsapp',
      recipient_phone: phoneNumber,
      message_content: messageText,
      status: 'received',
      crm_number_id: crmNumber?.id || null,
      metadata: {
        wa_message_id: message.id,
        message_type: messageType,
        timestamp: message.timestamp,
      },
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to store incoming message:', error);
    return;
  }

  console.log('Stored incoming message:', storedMessage?.id);

  // Create platform alert for new incoming message
  await supabase.from('platform_alerts').insert({
    alert_type: 'incoming_whatsapp',
    title: 'New WhatsApp Message',
    message: `From ${phoneNumber}: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`,
    severity: 'info',
    is_read: false,
  });

  // Check if this is a booking-related inquiry
  const bookingKeywords = ['book', 'appointment', 'schedule', 'available', 'time', 'slot'];
  const isBookingInquiry = bookingKeywords.some(keyword => messageText.toLowerCase().includes(keyword));

  if (isBookingInquiry && crmNumber?.clinic_id) {
    // Create a lead from the WhatsApp inquiry
    await supabase.from('leads').insert({
      clinic_id: crmNumber.clinic_id,
      patient_name: `WhatsApp User (${phoneNumber})`,
      patient_phone: phoneNumber,
      source: 'whatsapp',
      message: messageText,
      status: 'new',
    });

    console.log('Created lead from WhatsApp booking inquiry');
  }
}

async function processStatusUpdate(supabase: any, status: any) {
  console.log('Processing status update:', status);
  
  const waMessageId = status.id;
  const newStatus = status.status; // sent, delivered, read, failed
  
  // Map WhatsApp status to our status
  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  };

  const mappedStatus = statusMap[newStatus] || newStatus;
  
  // Update message status based on WhatsApp message ID stored in metadata
  const { error } = await supabase
    .from('clinic_messages')
    .update({
      status: mappedStatus,
      ...(mappedStatus === 'delivered' && { delivered_at: new Date().toISOString() }),
      ...(mappedStatus === 'failed' && { error_message: status.errors?.[0]?.message || 'Delivery failed' }),
    })
    .filter('metadata->wa_message_id', 'eq', waMessageId);

  if (error) {
    console.error('Failed to update message status:', error);
  } else {
    console.log(`Updated message ${waMessageId} to status: ${mappedStatus}`);
  }
}
