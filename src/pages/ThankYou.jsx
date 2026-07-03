/**
 * Thank You — post-checkout landing, polls Subscription status
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ThankYou() {
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const user = await base44.auth.me();
        const subs = await base44.entities.Subscription.filter({ user_email: user.email }, '-created_date', 1);
        if (!cancelled && subs.length > 0 && subs[0].status === 'active') {
          setStatus('active');
          return;
        }
      } catch (e) {
        // ignore, keep polling
      }
      if (!cancelled) setTimeout(poll, 2500);
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen px-6 text-center" style={{ background: 'var(--aether-bg)' }}>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: status === 'active' ? 'rgba(0,229,160,0.12)' : 'var(--aether-cyan-dim)', border: `1px solid ${status === 'active' ? 'rgba(0,229,160,0.3)' : 'rgba(0,212,255,0.3)'}` }}
      >
        {status === 'active'
          ? <CheckCircle size={28} style={{ color: '#00E5A0' }} />
          : <Loader2 size={28} className="animate-spin" style={{ color: 'var(--aether-cyan)' }} />
        }
      </div>
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--aether-text)' }}>
        {status === 'active' ? 'Aether Pro is active!' : 'Confirming your payment…'}
      </h1>
      <p className="text-sm max-w-xs" style={{ color: 'var(--aether-text-muted)' }}>
        {status === 'active'
          ? 'Your hosted backend is ready. Head to Settings to connect.'
          : 'This usually takes a few seconds. Feel free to head back — we\'ll finish activating in the background.'}
      </p>
      <Link to="/settings" className="mt-6 btn-cyan px-6 py-2.5 rounded-xl text-sm font-semibold">
        Go to Settings
      </Link>
    </div>
  );
}