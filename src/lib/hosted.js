/**
 * Hosted Aether: where the hosted service lives, the signed-in user's token, and the Stripe redirects.
 * Set VITE_AETHER_HOSTED_URL (for example wss://api.myaiguy.me) to turn the hosted plans on.
 */
import { base44 } from '@/api/base44Client';

export const HOSTED_URL = (import.meta.env.VITE_AETHER_HOSTED_URL || '').replace(/\/$/, '');
const API_URL = HOSTED_URL.replace(/^ws/, 'http'); // wss://host -> https://host

// The Base44 SDK keeps the signed-in user's access token here.
export const authToken = () => localStorage.getItem('base44_access_token');

async function billingRedirect(path, body = {}) {
  if (!API_URL) throw new Error('Hosted plans are not available yet.');
  const token = authToken();
  if (!token) return base44.auth.redirectToLogin(window.location.href);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) return base44.auth.redirectToLogin(window.location.href);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Billing is unavailable right now. Try again in a minute.');
  window.location.href = data.url;
}

export const startCheckout = (plan) => billingRedirect('/billing/checkout', { plan });
export const openBillingPortal = () => billingRedirect('/billing/portal');
