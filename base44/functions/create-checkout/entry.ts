import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const WIX_API_KEY = Deno.env.get('WIX_PAYMENTS_API_KEY');
    const WIX_SITE_ID = Deno.env.get('WIX_PAYMENTS_SITE_ID');
    if (!WIX_API_KEY || !WIX_SITE_ID) {
      return Response.json({ error: 'Payments not configured' }, { status: 500 });
    }

    const origin = req.headers.get('Origin') || '';

    const checkoutRes = await fetch('https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': WIX_API_KEY,
        'wix-site-id': WIX_SITE_ID,
      },
      body: JSON.stringify({
        cart: {
          items: [
            {
              name: 'Aether Pro — Hosted Backend',
              quantity: 1,
              price: '19.99',
              subscriptionInfo: {
                subscriptionSettings: { frequency: 'MONTH' },
                title: 'Aether Pro Monthly',
                description: 'Hosted Aether backend — no local setup required',
              },
            },
          ],
          customerInfo: { email: user.email },
        },
        callbackUrls: {
          postFlowUrl: origin + '/settings',
          thankYouPageUrl: origin + '/ThankYou',
        },
      }),
    });

    if (!checkoutRes.ok) {
      const errBody = await checkoutRes.text();
      console.error('Wix checkout error:', errBody);
      return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    const data = await checkoutRes.json();
    const checkoutSession = data.checkoutSession;

    await base44.asServiceRole.entities.Subscription.create({
      user_email: user.email,
      checkout_id: checkoutSession.id,
      status: 'pending',
    });

    return Response.json({ redirectUrl: checkoutSession.redirectUrl });
  } catch (error) {
    console.error('create-checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});