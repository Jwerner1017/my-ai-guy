import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Server, Cloud, Zap, Brain, Lock, ArrowRight, Check, Sparkles, ListChecks } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { HOSTED_URL, startCheckout } from '@/lib/hosted';

// Hosted limits must match PLANS in backend/aether/accounts.py; prices must match the Stripe prices.
const TIERS = [
  { id: 'free', name: 'Free', price: '$0', period: '', tag: 'No card needed', icon: Sparkles, hosted: true,
    features: ['30 messages a month', 'Fast model (Claude Haiku 5.5)', 'Web search, memory and task planning', 'Use it from any browser'] },
  { id: 'pro', name: 'Pro', price: '$12', period: '/month', tag: 'Cancel anytime', icon: Cloud, hosted: true, highlight: true,
    features: ['300 messages a month', 'Picks Claude Haiku 5.5 or Sonnet 5.5 for each request', 'Web search and page reading', 'Memory and tasks on every device'] },
  { id: 'power', name: 'Power', price: '$39', period: '/month', tag: 'For heavy use', icon: Zap, hosted: true,
    features: ['1,000 messages a month', 'Adds Claude Opus 5.5 for hard, multi-step work', 'Larger usage allowance for long research', 'Everything in Pro'] },
  { id: 'self_host', name: 'Self-Host', price: '$49', period: 'one-time', tag: 'Bring your own API key', icon: Server, hosted: false,
    features: ['Runs on your computer with your own Anthropic API key (you pay Anthropic for usage)', 'File and shell tools, each action approved by you', 'Any Claude model, no message limits from us', 'Memory, tasks and history stay on your machine'] },
];

const features = [
  { icon: Brain, title: 'An agent, not just chat', text: 'Built on Claude. It plans multi-step work, searches the web, reads pages and reports back.' },
  { icon: ListChecks, title: 'Remembers you', text: 'Keeps notes on you and your projects across sessions. Read or delete them any time.' },
  { icon: Lock, title: 'Private by design', text: 'Self-Host keeps memory, tasks and files on your computer. Hosted accounts are kept separate.' },
  { icon: Shield, title: 'You stay in control', text: 'On Self-Host, every file write and shell command waits for your approval.' },
];

function PricingCard({ tier, onCheckout, loadingTier }) {
  const Icon = tier.icon;
  const comingSoon = tier.hosted && !HOSTED_URL; // hosted service not deployed yet: don't sell it
  const label = comingSoon ? 'Coming soon'
    : loadingTier === tier.id ? 'Redirecting…'
    : tier.id === 'free' ? 'Start free'
    : tier.id === 'self_host' ? 'Buy Self-Host'
    : `Get ${tier.name}`;
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
        tier.highlight ? 'card-aether-active scale-[1.02]' : 'card-aether'
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold tag-cyan uppercase tracking-widest whitespace-nowrap">
          Most Popular
        </span>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--aether-cyan-dim)', border: '1px solid rgba(0,212,255,0.2)' }}
        >
          <Icon size={20} style={{ color: 'var(--aether-cyan)' }} />
        </div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--aether-text)' }}>{tier.name}</h3>
      </div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-4xl font-extrabold gradient-text-cyan">{tier.price}</span>
        <span className="text-sm" style={{ color: 'var(--aether-text-muted)' }}>{tier.period}</span>
      </div>
      <p className="text-xs mb-5" style={{ color: 'var(--aether-text-dim)' }}>{tier.tag}</p>
      <ul className="space-y-2.5 mb-6 flex-1">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--aether-text)' }}>
            <Check size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--aether-success)' }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => onCheckout(tier.id)}
        disabled={comingSoon || loadingTier === tier.id}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${tier.highlight ? 'btn-cyan' : 'btn-surface'}`}
      >
        {label}
      </button>
    </div>
  );
}

export default function Landing() {
  const [loadingTier, setLoadingTier] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleCheckout = async (tier) => {
    if (tier === 'free') return navigate('/');
    setError(null);
    setLoadingTier(tier);
    if (tier !== 'self_host') {
      try {
        await startCheckout(tier); // redirects to Stripe Checkout, or to sign-in first
      } catch (e) {
        setError(e.message);
      }
      setLoadingTier(null);
      return;
    }
    try {
      const res = await base44.functions.invoke('create-checkout', { tier });
      if (res.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      } else {
        setError(res.data?.error || 'Failed to start checkout');
        setLoadingTier(null);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Checkout failed');
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--aether-bg)' }}>
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        <div className="absolute inset-0 pointer-events-none aurora-gradient opacity-30" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 tag-violet text-xs font-semibold uppercase tracking-widest">
            <Shield size={12} /> Personal AI Agent
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold mb-5 leading-tight">
            Your private AI agent.{' '}
            <span className="gradient-text-cyan">Yours to own.</span>
          </h1>
          <p className="text-lg mx-auto max-w-2xl mb-8 leading-relaxed" style={{ color: 'var(--aether-text-muted)' }}>
            Aether Companion is a personal AI agent on Claude that remembers you, plans multi-step work
            and gets it done. Use it hosted from any browser, or run it on your own computer.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="#pricing" className="btn-cyan px-7 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
              See Pricing <ArrowRight size={16} />
            </a>
            <Link to="/" className="btn-surface px-7 py-3 rounded-xl text-sm font-semibold">
              Open App
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="card-aether p-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--aether-violet-dim)' }}
              >
                <f.icon size={20} style={{ color: 'var(--aether-purple)' }} />
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--aether-text)' }}>{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--aether-text-muted)' }}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-16 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--aether-text)' }}>Choose how you run it</h2>
          <p className="text-sm" style={{ color: 'var(--aether-text-muted)' }}>
            Start free. Upgrade when you need more, or run it yourself.
          </p>
        </div>
        {error && (
          <div className="mb-6 max-w-md mx-auto p-3 rounded-xl text-sm text-center tag-danger">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {TIERS.map(tier => <PricingCard key={tier.id} tier={tier} onCheckout={handleCheckout} loadingTier={loadingTier} />)}
        </div>
        <p className="text-xs text-center mt-8 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--aether-text-dim)' }}>
          Hosted plans also include a monthly usage allowance. Long research tasks and larger models use it faster, and the
          app shows how much is left. Messages and allowance reset on the 1st of each month. Hosted Aether can't reach your
          files or run commands on your computer; that needs Self-Host.
        </p>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 text-center border-t" style={{ borderColor: 'var(--aether-border)' }}>
        <p className="text-xs" style={{ color: 'var(--aether-text-dim)' }}>Aether Companion · Built on Claude</p>
      </footer>
    </div>
  );
}