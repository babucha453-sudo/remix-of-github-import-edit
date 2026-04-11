import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
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

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Webhook signature verification failed:', message);
        return new Response(
          JSON.stringify({ error: 'Webhook signature verification failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Parse without verification (for testing)
      event = JSON.parse(body);
      console.warn('Processing webhook without signature verification');
    }

    console.log('Processing webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription' && session.subscription) {
          const clinicId = session.metadata?.clinic_id;
          const planId = session.metadata?.plan_id;
          const userId = session.metadata?.user_id;

          if (clinicId && planId) {
            // Get subscription details from Stripe
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );

            const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
            const startsAt = new Date(subscription.current_period_start * 1000).toISOString();

            // Check if subscription exists
            const { data: existing } = await supabase
              .from('clinic_subscriptions')
              .select('id')
              .eq('clinic_id', clinicId)
              .maybeSingle();

            if (existing) {
              // Update existing subscription
              await supabase
                .from('clinic_subscriptions')
                .update({
                  plan_id: planId,
                  status: 'active',
                  stripe_subscription_id: subscription.id,
                  starts_at: startsAt,
                  expires_at: expiresAt,
                  billing_cycle: 'monthly',
                  amount_paid: session.amount_total ? session.amount_total / 100 : null,
                  next_billing_date: expiresAt,
                  updated_at: new Date().toISOString(),
                })
                .eq('clinic_id', clinicId);
            } else {
              // Create new subscription
              await supabase
                .from('clinic_subscriptions')
                .insert({
                  clinic_id: clinicId,
                  plan_id: planId,
                  status: 'active',
                  stripe_subscription_id: subscription.id,
                  starts_at: startsAt,
                  expires_at: expiresAt,
                  billing_cycle: 'monthly',
                  amount_paid: session.amount_total ? session.amount_total / 100 : null,
                  next_billing_date: expiresAt,
                });
            }

            // Log the subscription activation
            await supabase.from('audit_logs').insert({
              action: 'SUBSCRIPTION_ACTIVATED',
              entity_type: 'clinic_subscription',
              entity_id: clinicId,
              user_id: userId,
              new_values: {
                plan_id: planId,
                stripe_subscription_id: subscription.id,
                expires_at: expiresAt,
              },
            });

            console.log(`Subscription activated for clinic ${clinicId}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const clinicId = subscription.metadata?.clinic_id;

        if (clinicId) {
          const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
          
          let status = 'active';
          if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            status = 'cancelled';
          } else if (subscription.status === 'past_due') {
            status = 'expired';
          }

          await supabase
            .from('clinic_subscriptions')
            .update({
              status,
              expires_at: expiresAt,
              next_billing_date: expiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id);

          console.log(`Subscription updated for clinic ${clinicId}: ${status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await supabase
          .from('clinic_subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        console.log(`Subscription cancelled: ${subscription.id}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
          
          const clinicId = subscription.metadata?.clinic_id;
          
          if (clinicId) {
            const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
            
            await supabase
              .from('clinic_subscriptions')
              .update({
                status: 'active',
                expires_at: expiresAt,
                next_billing_date: expiresAt,
                amount_paid: invoice.amount_paid ? invoice.amount_paid / 100 : null,
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_subscription_id', subscription.id);

            console.log(`Payment succeeded, subscription extended for clinic ${clinicId}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription) {
          await supabase
            .from('clinic_subscriptions')
            .update({
              status: 'expired',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription as string);

          console.log(`Payment failed for subscription: ${invoice.subscription}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
