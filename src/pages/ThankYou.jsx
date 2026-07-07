import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Download, Server, Cloud, ArrowRight, Terminal } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SELF_HOST_STEPS = [
  { title: 'Clone the backend', command: 'git clone https://github.com/yourname/aether-backend.git' },
  { title: 'Install dependencies', command: 'pip install -r requirements.txt' },
  { title: 'Pull an Ollama model', command: 'ollama pull llama3' },
  { title: 'Run the agent server', command: 'python main.py' },
];

function ThankYouContent({ tier, status }) {
  const isHosted = tier === 'hosted_pro';

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
          {status === 'pending' ? 'Payment received — verifying' : 'Welcome to Aether!'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--aether-text-muted)' }}>
          {isHosted
            ? 'Your hosted instance is being provisioned. We\'ll email you connection details shortly.'
            : 'Your license is active. Follow the steps below to get your agent running.'}
        </p>
      </div>

      {isHosted ? (
        <div className="card-aether p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Cloud size={18} style={{ color: 'var(--aether-cyan)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--aether-text)' }}>Hosted Pro Setup</h3>
          </div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--aether-text-muted)' }}>
            Your dedicated backend is spinning up in the cloud. You'll receive an email with:
          </p>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--aether-text)' }}>
            <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--aether-success)' }} />Your unique host & port</li>
            <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--aether-success)' }} />QR code for one-tap connect</li>
            <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--aether-success)' }} />Cloud memory sync credentials</li>
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
            onClick={() => window.location.href = 'https://github.com/yourname/aether-backend/releases/latest'}
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