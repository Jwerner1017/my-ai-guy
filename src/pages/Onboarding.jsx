/**
 * Onboarding — Beautiful animated launch experience
 * Splash → 3 intro cards → Connection setup → Permissions → Dashboard
 */
import React, { useState, useEffect } from 'react';
import { ChevronRight, Brain, Shield, Zap, Wifi } from 'lucide-react';
import ParticleField from '@/components/aether/ParticleField';
import ConnectionSetup from '@/components/aether/ConnectionSetup';
import useAetherStore from '@/lib/aetherStore';

// ── Aether Logo ───────────────────────────────────────────────────────────────
function AetherLogo({ size = 80, animated = true }) {
  return (
    <div
      className={`relative flex items-center justify-center ${animated ? 'animate-breathe' : ''}`}
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(108,62,255,0.2))',
          boxShadow: '0 0 40px rgba(0,212,255,0.25), 0 0 80px rgba(108,62,255,0.15)',
          borderRadius: size * 0.25,
        }}
      />
      {/* Inner icon */}
      <div
        className="relative flex items-center justify-center rounded-xl"
        style={{
          width: size * 0.75,
          height: size * 0.75,
          background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(108,62,255,0.25))',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: size * 0.18,
        }}
      >
        <Brain size={size * 0.38} style={{ color: '#00D4FF' }} />
      </div>
    </div>
  );
}

// ── Splash Screen ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => onDone(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center aurora-gradient"
      style={{ transition: 'opacity 0.5s ease', opacity: visible ? 1 : 0 }}
    >
      <ParticleField count={25} />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <AetherLogo size={90} animated />

        <div className="text-center" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease 0.4s' }}>
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em' }}
          >
            <span className="gradient-text-cyan">Aether</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 tracking-widest uppercase font-medium">
            Sovereign Intelligence
          </p>
        </div>

        {/* Loading dots */}
        <div className="flex gap-1.5" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 1.2s' }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'var(--aether-cyan)',
                animation: `orbPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Intro Cards ───────────────────────────────────────────────────────────────
const INTRO_CARDS = [
  {
    icon: Brain,
    iconColor: '#00D4FF',
    title: 'Your Personal Intelligence',
    body: 'Aether is a self-improving AI agent that runs entirely on your machine. It plans, reasons, and acts — and it gets smarter with every session.',
    accent: 'rgba(0, 212, 255, 0.1)',
    border: 'rgba(0, 212, 255, 0.2)',
  },
  {
    icon: Zap,
    iconColor: '#9B5CFF',
    title: 'You Stay in Control',
    body: 'Every tool Aether uses requires your explicit approval. You see its reasoning in real time and can pause, redirect, or stop execution at any moment.',
    accent: 'rgba(108, 62, 255, 0.1)',
    border: 'rgba(108, 62, 255, 0.25)',
  },
  {
    icon: Shield,
    iconColor: '#00E5A0',
    title: 'Sovereign & Private',
    body: 'Your data never leaves your machine unless you authorize it. No cloud, no tracking, no external accounts. Aether is yours, completely.',
    accent: 'rgba(0, 229, 160, 0.08)',
    border: 'rgba(0, 229, 160, 0.2)',
  },
];

function IntroSlides({ onDone }) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goNext = () => {
    if (animating) return;
    if (current === INTRO_CARDS.length - 1) {
      onDone();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setCurrent(c => c + 1);
      setAnimating(false);
    }, 250);
  };

  const card = INTRO_CARDS[current];
  const Icon = card.icon;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--aether-bg)' }}>
      {/* Progress dots */}
      <div className="flex gap-2 justify-center pt-12 pb-6">
        {INTRO_CARDS.map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-400"
            style={{
              width: i === current ? 24 : 6,
              background: i === current ? 'var(--aether-cyan)' : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 text-center"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(10px)' : 'translateY(0)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
        }}
      >
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8"
          style={{
            background: card.accent,
            border: `1px solid ${card.border}`,
            boxShadow: `0 0 40px ${card.accent}`,
          }}
        >
          <Icon size={38} style={{ color: card.iconColor }} />
        </div>

        <h2
          className="text-2xl font-bold mb-4 leading-tight"
          style={{ color: 'var(--aether-text)', letterSpacing: '-0.02em' }}
        >
          {card.title}
        </h2>
        <p className="text-base leading-relaxed" style={{ color: 'var(--aether-text-muted)', maxWidth: 320 }}>
          {card.body}
        </p>
      </div>

      {/* Next button */}
      <div className="px-6 pb-10">
        <button
          onClick={goNext}
          className="w-full btn-cyan py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2"
        >
          {current === INTRO_CARDS.length - 1 ? 'Connect to Aether' : 'Continue'}
          <ChevronRight size={18} />
        </button>

        {current < INTRO_CARDS.length - 1 && (
          <button
            onClick={onDone}
            className="w-full text-center text-sm text-gray-600 mt-3 py-2"
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}

// ── Connection Screen ─────────────────────────────────────────────────────────
function ConnectionScreen({ onConnected }) {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--aether-bg)' }}>
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--aether-cyan-dim)' }}
          >
            <Wifi size={20} style={{ color: 'var(--aether-cyan)' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--aether-text)' }}>Connect to Aether</h2>
            <p className="text-sm" style={{ color: 'var(--aether-text-muted)' }}>
              Make sure Aether is running on your computer
            </p>
          </div>
        </div>

        <ConnectionSetup onConnected={onConnected} />
      </div>

      {/* Skip for demo */}
      <div className="px-5 pb-8 flex-shrink-0">
        <button
          onClick={onConnected}
          className="w-full text-center text-sm py-3"
          style={{ color: 'var(--aether-text-dim)' }}
        >
          Continue without connecting (demo mode)
        </button>
      </div>
    </div>
  );
}

// ── Main Onboarding ───────────────────────────────────────────────────────────
const STAGES = ['splash', 'intro', 'connect'];

export default function Onboarding({ onComplete }) {
  const [stage, setStage] = useState('splash');
  const { completeOnboarding, loadMockData } = useAetherStore();

  const handleConnected = () => {
    completeOnboarding();
    onComplete?.();
  };

  const handleDemoMode = () => {
    loadMockData();
    onComplete?.();
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: 'var(--aether-bg)' }}>
      {stage === 'splash' && (
        <SplashScreen onDone={() => setStage('intro')} />
      )}
      {stage === 'intro' && (
        <IntroSlides onDone={() => setStage('connect')} />
      )}
      {stage === 'connect' && (
        <ConnectionScreen onConnected={handleConnected} />
      )}
    </div>
  );
}