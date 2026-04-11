import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GMB Booking Link Manager
 * 
 * Manages the "Book Appointment" link on Google Business Profile listings.
 * Uses the My Business Place Actions API to create/update/delete booking links.
 * 
 * Actions:
 * - set: Creates or updates the booking link on GMB
 * - remove: Removes the booking link from GMB
 * - status: Returns current booking link status
 */

const BOOKING_BASE_URL = 'https://www.appointpanda.com';

interface PlaceActionLink {
  name?: string;
  placeActionType: 'APPOINTMENT' | 'ONLINE_APPOINTMENT' | 'RESERVE';
  uri: string;
  isEditable?: boolean;
  isPreferred?: boolean;
  createTime?: string;
  updateTime?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Parse request
    const body = await req.json();
    const { action, clinicId } = body;

    if (!clinicId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinicId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns this clinic
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('id, slug, name, claimed_by, google_place_id')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ success: false, error: 'Clinic not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (clinic.claimed_by !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: You do not own this clinic' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth tokens for this clinic
    const { data: oauthTokens, error: tokenError } = await supabaseAdmin
      .from('clinic_oauth_tokens')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();

    if (tokenError || !oauthTokens) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'GMB not connected. Please connect your Google Business Profile first.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!oauthTokens.gmb_access_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'GMB access token not available. Please reconnect your Google Business Profile.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct the booking URL for this clinic
    const bookingUrl = `${BOOKING_BASE_URL}/book/${clinicId}`;

    switch (action) {
      case 'set': {
        // Create or update booking link on GMB
        const result = await setBookingLink(
          oauthTokens.gmb_access_token,
          oauthTokens.gmb_location_id || oauthTokens.gmb_account_id,
          bookingUrl,
          oauthTokens.gmb_booking_link_id
        );

        if (!result.success) {
          // If token expired, try to refresh and retry
          if (result.error?.includes('401') || result.error?.includes('UNAUTHENTICATED')) {
            const refreshResult = await refreshAccessToken(
              supabaseAdmin,
              clinicId,
              oauthTokens.gmb_refresh_token
            );
            
            if (refreshResult.success && refreshResult.accessToken) {
              const retryResult = await setBookingLink(
                refreshResult.accessToken,
                oauthTokens.gmb_location_id || oauthTokens.gmb_account_id,
                bookingUrl,
                oauthTokens.gmb_booking_link_id
              );
              
              if (retryResult.success) {
                await supabaseAdmin
                  .from('clinic_oauth_tokens')
                  .update({
                    gmb_booking_link_enabled: true,
                    gmb_booking_link_id: retryResult.linkId,
                    gmb_booking_link_set_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('clinic_id', clinicId);

                return new Response(
                  JSON.stringify({ 
                    success: true, 
                    message: 'Booking link set on Google Business Profile',
                    linkId: retryResult.linkId,
                    bookingUrl,
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          }

          return new Response(
            JSON.stringify({ success: false, error: result.error }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update database with link status
        await supabaseAdmin
          .from('clinic_oauth_tokens')
          .update({
            gmb_booking_link_enabled: true,
            gmb_booking_link_id: result.linkId,
            gmb_booking_link_set_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('clinic_id', clinicId);

        // Log to audit
        await supabaseAdmin.from('audit_logs').insert({
          action: 'GMB_BOOKING_LINK_SET',
          entity_type: 'clinic',
          entity_id: clinicId,
          user_id: userId,
          new_values: { bookingUrl, linkId: result.linkId },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Booking link set on Google Business Profile',
            linkId: result.linkId,
            bookingUrl,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'remove': {
        // Remove booking link from GMB
        if (!oauthTokens.gmb_booking_link_id) {
          // No link to remove, just update DB
          await supabaseAdmin
            .from('clinic_oauth_tokens')
            .update({
              gmb_booking_link_enabled: false,
              gmb_booking_link_id: null,
              gmb_booking_link_set_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('clinic_id', clinicId);

          return new Response(
            JSON.stringify({ success: true, message: 'Booking link disabled' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await removeBookingLink(
          oauthTokens.gmb_access_token,
          oauthTokens.gmb_booking_link_id
        );

        // Update database regardless of API result (user wants it disabled)
        await supabaseAdmin
          .from('clinic_oauth_tokens')
          .update({
            gmb_booking_link_enabled: false,
            gmb_booking_link_id: null,
            gmb_booking_link_set_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('clinic_id', clinicId);

        // Log to audit
        await supabaseAdmin.from('audit_logs').insert({
          action: 'GMB_BOOKING_LINK_REMOVED',
          entity_type: 'clinic',
          entity_id: clinicId,
          user_id: userId,
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: result.success 
              ? 'Booking link removed from Google Business Profile' 
              : 'Booking link disabled (could not remove from GMB)',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        return new Response(
          JSON.stringify({
            success: true,
            enabled: oauthTokens.gmb_booking_link_enabled ?? false,
            linkId: oauthTokens.gmb_booking_link_id,
            setAt: oauthTokens.gmb_booking_link_set_at,
            bookingUrl: oauthTokens.gmb_booking_link_enabled ? bookingUrl : null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('GMB booking link error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Set or update the booking link on GMB using Place Actions API
 */
async function setBookingLink(
  accessToken: string,
  locationId: string | null,
  bookingUrl: string,
  existingLinkId: string | null
): Promise<{ success: boolean; linkId?: string; error?: string }> {
  if (!locationId) {
    return { success: false, error: 'GMB location ID not available' };
  }

  try {
    const placeActionLink: PlaceActionLink = {
      placeActionType: 'APPOINTMENT',
      uri: bookingUrl,
      isPreferred: true,
    };

    let response: Response;
    let endpoint: string;

    if (existingLinkId) {
      // Update existing link
      endpoint = `https://mybusinessplaceactions.googleapis.com/v1/${existingLinkId}`;
      response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(placeActionLink),
      });
    } else {
      // Create new link
      // Format: locations/{location_id}/placeActionLinks
      endpoint = `https://mybusinessplaceactions.googleapis.com/v1/locations/${locationId}/placeActionLinks`;
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(placeActionLink),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      console.error('GMB Place Actions API error:', data);
      return { 
        success: false, 
        error: data.error?.message || `API error: ${response.status}` 
      };
    }

    return { 
      success: true, 
      linkId: data.name // The resource name of the created/updated link
    };
  } catch (error) {
    console.error('Error setting booking link:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to set booking link' 
    };
  }
}

/**
 * Remove the booking link from GMB
 */
async function removeBookingLink(
  accessToken: string,
  linkId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://mybusinessplaceactions.googleapis.com/v1/${linkId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const data = await response.json();
      console.error('GMB Place Actions API delete error:', data);
      return { 
        success: false, 
        error: data.error?.message || `API error: ${response.status}` 
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing booking link:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to remove booking link' 
    };
  }
}

/**
 * Refresh the GMB access token using the refresh token
 */
async function refreshAccessToken(
  supabaseAdmin: any,
  clinicId: string,
  refreshToken: string | null
): Promise<{ success: boolean; accessToken?: string }> {
  if (!refreshToken) {
    return { success: false };
  }

  try {
    // Try to get OAuth credentials from environment first, then fall back to global_settings
    let clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.log('Google OAuth credentials not in env, checking global_settings...');
      const { data: settingsData } = await supabaseAdmin
        .from('global_settings')
        .select('value')
        .eq('key', 'google_oauth')
        .single();
      
      if (settingsData?.value && typeof settingsData.value === 'object') {
        const settings = settingsData.value as Record<string, unknown>;
        clientId = settings.client_id as string;
        clientSecret = settings.client_secret as string;
        if (clientId && clientSecret) {
          console.log('Using Google OAuth credentials from global_settings');
        }
      }
    }

    if (!clientId || !clientSecret) {
      console.error('Google OAuth credentials not configured in env or global_settings');
      return { success: false };
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error('Token refresh failed:', data);
      return { success: false };
    }

    // Update stored access token
    await supabaseAdmin
      .from('clinic_oauth_tokens')
      .update({
        gmb_access_token: data.access_token,
        updated_at: new Date().toISOString(),
      })
      .eq('clinic_id', clinicId);

    return { success: true, accessToken: data.access_token };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return { success: false };
  }
}
