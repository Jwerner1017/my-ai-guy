import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Download, Server, Cloud, ArrowRight, Terminal } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const REPO = 'https://github.com/Jwerner1017/my-ai-guy';
const SELF_HOST_STEPS = [
  { title: 'Get the code (needs Python 3.10+)', command: `git clone ${REPO}.git && cd my-ai-guy/backend` },
  { title: 'Install it', command: 'pip install -e .' },
  { title: 'Add your Anthropic API key', command: 'export ANTHROPIC_API_KEY=sk-ant-...' },
  { title: 'Start it, then connect the app to 127.0.0.1:8765', command: 'aether-server' },
];
const HOSTED_STEPS = [
  'Open the app and choose "Use hosted Aether with your account"',
  'Your plan switches on as soon as Stripe confirms the payment, usually within seconds',
  'See your plan and usage any time under Settings, Plan & Usage',
];

function ThankYouContent({ tier, status }) {
  const isHosted = tier === 'pro' || tier === 'power';

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)' }}
        >
          <CheckCircle size={32} style={{ color: 'var(--aether-success)' }} />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--aether-text)' }}>
          {!isHosted && status === 'pending' ? 'Payment received — verifying' : 'Welcome to Aether!'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--aether-text-muted)' }}>
          {isHosted
            ? `Your ${tier === 'power' ? 'Power' : 'Pro'} plan is ready to use.`
            : 'Your license is active. Follow the steps below to get your agent running.'}
        </p>
      </div>

      {isHosted ? (
        <div className="card-aether p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Cloud size={18} style={{ color: 'var(--aether-cyan)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--aether-text)' }}>Start using hosted Aether</h3>
          </div>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--aether-text)' }}>
            {HOSTED_STEPS.map(step => (
              <li key={step} className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--aether-success)' }} />{step}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="card-aether p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Server size={18} style={{ color: 'var(--aether-cyan)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--aether-text)' }}>Setup in 4 steps</h3>
          </div>
          <div className="space-y-4">
            {SELF_HOST_STEPS.map((step, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold tag-cyan">{i + 1}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--aether-text)' }}>{step.title}</span>
                </div>
                <div className="ml-7 rounded-lg p-2.5 font-mono-aether text-xs flex items-center gap-2"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--aether-border)', color: 'var(--aether-cyan)' }}>
                  <Terminal size={12} className="flex-shrink-0" style={{ color: 'var(--aether-text-dim)' }} />
                  <code>{step.command}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="btn-cyan px-6 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2">
          Open Aether App <ArrowRight size={16} />
        </Link>
        {!isHosted ? (
          <button
            onClick={() => window.location.href = `${REPO}/archive/refs/heads/main.zip`}
            className="btn-surface px-6 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Download size={16} /> Download Package
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function ThankYou() {
  const [purchases, setPurchases] = useState(null);
  const [tier, setTier] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tierParam = params.get('tier') || 'self_host';
    setTier(tierParam);

    // Attempt to find a corresponding purchase record for this checkout.
    base44.entities.Purchase.filter({})
      .then((records) => setPurchases(records))
      .catch(() => setPurchases([]));
  }, []);

  const matched = purchases && purchases.length > 0
    ? purchases
        .filter(p => p.product_tier === tier)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0]
    : null;
  const status = matched?.status === 'paid' || matched?.status === 'active' ? 'confirmed' : 'pending';

  return (
    <div className="min-h-screen" style={{ background: 'var(--aether-bg)' }}>
      <ThankYouContent tier={tier} status={status} />
    </div>
  );
}