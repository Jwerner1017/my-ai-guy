import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const WIX_API_KEY = Deno.env.get("WIX_PAYMENTS_API_KEY");
const WIX_SITE_ID = Deno.env.get("WIX_PAYMENTS_SITE_ID");

// Product catalog — single source of truth for both tiers
const PRODUCTS = {
  self_host: {
    name: "Aether Companion — Self-Host License",
    price: "49.00",
    type: "one_time",
  },
  hosted_pro: {
    name: "Aether Companion — Hosted Pro (Monthly)",
    price: "19.00",
    type: "subscription",
    subscriptionInfo: {
      subscriptionSettings: { frequency: "MONTH" },
      title: "Hosted Pro — Monthly",
      description: "We host your Aether backend instance. Cancel anytime.",
    },
  },
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await req.json();
    const tier = body?.tier;
    const product = PRODUCTS[tier];
    if (!product) {
      return Response.json({ error: "Invalid product tier. Use 'self_host' or 'hosted_pro'." }, { status: 400 });
    }

    if (!WIX_API_KEY || !WIX_SITE_ID) {
      console.error("Missing WIX_PAYMENTS_API_KEY or WIX_PAYMENTS_SITE_ID");
      return Response.json({ error: "Payments not configured" }, { status: 500 });
    }

    // Origin header = app base URL (req.url is wrong inside Deno.serve)
    const origin = req.headers.get("Origin") || req.headers.get("origin");
    if (!origin) {
      return Response.json({ error: "Missing Origin header" }, { status: 400 });
    }
    const postFlowUrl = `${origin}/`;
    const thankYouPageUrl = `${origin}/thank-you?tier=${tier}`;

    const item = {
      name: product.name,
      quantity: 1,
      price: product.price,
    };
    if (product.type === "subscription") {
      item.subscriptionInfo = product.subscriptionInfo;
    }

    const response = await fetch(
      "https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": WIX_API_KEY,
          "wix-site-id": WIX_SITE_ID,
        },
        body: JSON.stringify({
          cart: { items: [item] },
          callbackUrls: { postFlowUrl, thankYouPageUrl },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Wix checkout construct failed:", JSON.stringify(data));
      return Response.json(
        { error: data?.message || "Failed to create checkout session" },
        { status: response.status }
      );
    }

    const checkoutSession = data.checkoutSession;

    // Persist a pending purchase record so the webhook can correlate later.
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.Purchase.create({
        checkout_id: checkoutSession.id,
        product_tier: tier,
        status: "pending",
      });
    } catch (e) {
      // Non-fatal — checkout still works; webhook will create if needed.
      console.error("Failed to persist pending purchase:", e?.message || e);
    }

    return Response.json({ redirectUrl: checkoutSession.redirectUrl, checkoutId: checkoutSession.id });
  } catch (error) {
    console.error("create-checkout error:", error?.message || error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});