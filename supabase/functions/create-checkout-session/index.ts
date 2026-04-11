import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  planSlug: string;
  clinicId: string;
  successUrl?: string;
  cancelUrl?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { planSlug, clinicId, successUrl, cancelUrl }: CheckoutRequest = await req.json();

    if (!planSlug || !clinicId) {
      throw new Error('Missing required parameters: planSlug and clinicId');
    }

    // Get plan details from database
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found: ' + planSlug);
    }

    // Get clinic details
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, email')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      throw new Error('Clinic not found');
    }

    // Check for existing Stripe customer
    let customerId: string | undefined;
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
          clinic_id: clinicId,
          clinic_name: clinic.name,
        },
      });
      customerId = customer.id;
    }

    // Create or get Stripe product
    const products = await stripe.products.list({
      limit: 100,
    });
    
    let product = products.data.find((p: Stripe.Product) => p.metadata?.plan_slug === planSlug);
    
    if (!product) {
      product = await stripe.products.create({
        name: `${plan.name} Plan - AppointPanda`,
        description: plan.description || `${plan.name} subscription plan`,
        metadata: {
          plan_id: plan.id,
          plan_slug: planSlug,
        },
      });
    }

    // Create or get price (monthly-only model using price_monthly)
    // Apply 50% promotion discount
    const originalMonthlyPrice = plan.price_monthly || plan.price_aed || 0;
    const discountedPrice = Math.round(originalMonthlyPrice * 0.5); // 50% off
    
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 10,
    });

    // Find a monthly price matching our discounted plan price
    let price = prices.data.find(
      (p: Stripe.Price) => p.unit_amount === discountedPrice * 100 && p.recurring?.interval === 'month'
    );

    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: discountedPrice * 100, // Convert to cents (50% off)
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          plan_id: plan.id,
          plan_slug: planSlug,
          original_price: originalMonthlyPrice.toString(),
          discount_percent: '50',
          promotion: 'launch_50_off',
        },
      });
    }

    // Create checkout session
    const baseUrl = successUrl?.split('/')[0] + '//' + successUrl?.split('/')[2] || 'https://appointpanda.com';
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${baseUrl}/admin?tab=dashboard&subscription=success`,
      cancel_url: cancelUrl || `${baseUrl}/pricing?subscription=cancelled`,
      metadata: {
        clinic_id: clinicId,
        plan_id: plan.id,
        plan_slug: planSlug,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          clinic_id: clinicId,
          plan_id: plan.id,
          plan_slug: planSlug,
          user_id: user.id,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error('Checkout session error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
