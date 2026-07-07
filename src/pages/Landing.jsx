import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Server, Cloud, Zap, Brain, Lock, ArrowRight, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TIER_SELF_HOST = { id: 'self_host', name: 'Self-Host', price: '$49', period: 'one-time', tag: 'Free forever after', highlight: false,
  features: ['Full Python backend (LangGraph + Ollama)', 'Local memory via ChromaDB', 'Browser automation (Playwright)', 'Voice (Whisper + Piper)', 'All your data stays on your machine'] };
const TIER_HOSTED_PRO = { id: 'hosted_pro', name: 'Hosted Pro', price: '$19', period: '/month', tag: 'Zero setup', highlight: true,
  features: ['We host & maintain your Aether instance', 'No Python, Ollama, or GPU needed', 'Cloud-synced memory backup', 'Automatic updates & model upgrades', 'Connect from any device, anywhere'] };

const features = [
  { icon: Brain, title: 'Reasoning Agent', text: 'LangGraph planner → executor → reflector with real tool calling.' },
  { icon: Lock, title: 'Sovereignly Private', text: 'Self-host runs fully offline. Your data never leaves your machine.' },
  { icon: Zap, title: 'Voice + Barge-in', text: 'Local Whisper transcription and Piper TTS with live barge-in.' },
  { icon: Server, title: 'Self-Improving', text: 'ChromaDB memory with recency + importance scoring that learns.' },
];

function PricingCard({ tier, onCheckout, loadingTier }) {
  const Icon = tier.id === 'self_host' ? Server : Cloud;
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
        tier.highlight ? 'card-aether-active scale-[1.02]' : 'card-aether'
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold tag-cyan uppercase tracking-widest">
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
        disabled={loadingTier === tier.id}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${tier.highlight ? 'btn-cyan' : 'btn-surface'}`}
      >
        {loadingTier === tier.id ? 'Redirecting…' : tier.id === 'hosted_pro' ? `Start ${tier.name}` : `Buy ${tier.name}`}
      </button>
    </div>
  );
}

export default function Landing() {
  const [loadingTier, setLoadingTier] = useState(null);
  const [error, setError] = useState(null);

  const handleCheckout = async (tier) => {
    setError(null);
    setLoadingTier(tier);
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
            <Shield size={12} /> Sovereign AI Agent
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold mb-5 leading-tight">
            Your private AI agent.{' '}
            <span className="gradient-text-cyan">Yours to own.</span>
          </h1>
          <p className="text-lg mx-auto max-w-2xl mb-8 leading-relaxed" style={{ color: 'var(--aether-text-muted)' }}>
            Aether Companion is a local-first reasoning agent that remembers, learns, and acts —
            with a real tool-calling brain and voice. Run it on your machine, or let us run it for you.
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
      <section id="pricing" className="px-6 py-16 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--aether-text)' }}>Choose your sovereignty</h2>
          <p className="text-sm" style={{ color: 'var(--aether-text-muted)' }}>
            Both tiers get the full Aether engine. Hosted Pro just removes the setup.
          </p>
        </div>
        {error && (
          <div className="mb-6 max-w-md mx-auto p-3 rounded-xl text-sm text-center tag-danger">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <PricingCard tier={TIER_SELF_HOST} onCheckout={handleCheckout} loadingTier={loadingTier} />
          <PricingCard tier={TIER_HOSTED_PRO} onCheckout={handleCheckout} loadingTier={loadingTier} />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 text-center border-t" style={{ borderColor: 'var(--aether-border)' }}>
        <p className="text-xs" style={{ color: 'var(--aether-text-dim)' }}>Aether Companion · Local-first, by design</p>
      </footer>
    </div>
  );
}