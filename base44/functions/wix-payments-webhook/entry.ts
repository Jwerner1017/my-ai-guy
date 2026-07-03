import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jwt from 'npm:jsonwebtoken@9.0.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const WEBHOOK_PUBLIC_KEY = Deno.env.get('WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
    if (!WEBHOOK_PUBLIC_KEY) {
      console.error('Missing WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
      return Response.json({ error: 'Not configured' }, { status: 500 });
    }

    const body = await req.text();
    let rawPayload;
    try {
      rawPayload = jwt.verify(body, WEBHOOK_PUBLIC_KEY, { algorithms: ['RS256'] });
    } catch (e) {
      console.error('Webhook signature verification failed:', e.message);
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawPayload.data);
    const eventData = JSON.parse(event.data);

    if (event.eventType === 'wix.ecom.v1.order_approved') {
      const order = eventData.actionEvent.body.order;
      const checkoutId = order.checkoutId;

      for (const lineItem of order.lineItems) {
        if (lineItem.subscriptionInfo) {
          const subscriptionId = lineItem.subscriptionInfo.id;
          const existing = await base44.asServiceRole.entities.Subscription.filter({ checkout_id: checkoutId });
          if (existing.length > 0) {
            await base44.asServiceRole.entities.Subscription.update(existing[0].id, {
              subscription_id: subscriptionId,
              buyer_email: order.buyerInfo?.email || '',
              status: 'active',
            });
          } else {
            console.error('No pending Subscription found for checkoutId:', checkoutId);
          }
        }
      }
    } else if (event.eventType === 'wix.ecom.subscription_contracts.v1.subscription_contract_canceled') {
      const subscriptionContract = eventData.actionEvent.body.subscriptionContract;
      const existing = await base44.asServiceRole.entities.Subscription.filter({ subscription_id: subscriptionContract.id });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.Subscription.update(existing[0].id, { status: 'canceled' });
      }
    } else if (event.eventType === 'wix.ecom.subscription_contracts.v1.subscription_contract_expired') {
      const subscriptionContract = eventData.actionEvent.body.subscriptionContract;
      const existing = await base44.asServiceRole.entities.Subscription.filter({ subscription_id: subscriptionContract.id });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.Subscription.update(existing[0].id, { status: 'ended' });
      }
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('wix-payments-webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});