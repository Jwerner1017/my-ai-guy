import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jwt from 'npm:jsonwebtoken@9.0.2';

const WEBHOOK_PUBLIC_KEY = Deno.env.get("WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY");

Deno.serve(async (req) => {
  try {
    // Wix-only webhooks have no user auth — use service role.
    if (!WEBHOOK_PUBLIC_KEY) {
      console.error("Missing WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY");
      return new Response("Missing public key", { status: 500 });
    }

    const requestBody = await req.text();

    // Step 1: Verify JWT signature — fail closed.
    let rawPayload;
    try {
      rawPayload = jwt.verify(requestBody, WEBHOOK_PUBLIC_KEY, { algorithms: ["RS256"] });
    } catch (err) {
      console.error("JWT verification failed:", err?.message || err);
      return new Response("Signature verification failed", { status: 401 });
    }

    // Step 2: Parse double-nested JSON.
    const event = JSON.parse(rawPayload.data); // WebhookEnvelope { eventType, data }
    const eventData = JSON.parse(event.data);  // Has actionEvent.body

    const base44 = createClientFromRequest(req);

    if (event.eventType === "wix.ecom.v1.order_approved") {
      const order = eventData.actionEvent.body.order;
      const checkoutId = order.checkoutId;
      const buyerEmail = order.buyerInfo?.email;
      const total = order.priceSummary?.total?.amount;
      const currency = order.currency;

      // Find the line items to determine tier + subscription id.
      let productTier = null;
      let subscriptionId = null;
      for (const lineItem of order.lineItems || []) {
        const name = lineItem.productName?.original || "";
        if (/hosted pro/i.test(name)) productTier = "hosted_pro";
        else if (/self-host/i.test(name)) productTier = "self_host";
        if (lineItem.subscriptionInfo?.id) {
          subscriptionId = lineItem.subscriptionInfo.id;
        }
      }

      // Match the pending purchase we created at checkout time.
      const existing = await base44.asServiceRole.entities.Purchase.filter({ checkout_id: checkoutId });
      const status = subscriptionId ? "active" : "paid";

      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.Purchase.update(existing[0].id, {
          status,
          order_id: order.id,
          email: buyerEmail,
          amount: total ? parseFloat(total) : undefined,
          currency,
          subscription_id: subscriptionId || undefined,
        });
      } else {
        await base44.asServiceRole.entities.Purchase.create({
          checkout_id: checkoutId,
          order_id: order.id,
          subscription_id: subscriptionId || undefined,
          product_tier: productTier || "self_host",
          status,
          email: buyerEmail,
          amount: total ? parseFloat(total) : undefined,
          currency,
        });
      }
    } else if (
      event.eventType === "wix.ecom.subscription_contracts.v1.subscription_contract_canceled" ||
      event.eventType === "wix.ecom.subscription_contracts.v1.subscription_contract_expired"
    ) {
      const subscriptionContract = eventData.actionEvent.body.subscriptionContract;
      const subscriptionId = subscriptionContract.id;
      const newStatus = event.eventType.endsWith("canceled") ? "canceled" : "expired";

      // Match by subscription id (only way to correlate these events).
      const records = await base44.asServiceRole.entities.Purchase.filter({ subscription_id: subscriptionId });
      for (const rec of records) {
        await base44.asServiceRole.entities.Purchase.update(rec.id, { status: newStatus });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("wix-payments-webhook error:", error?.message || error);
    return new Response("Internal error", { status: 500 });
  }
});