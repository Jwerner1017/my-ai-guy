/**
 * Voice Mode — Full-screen focused voice interface
 * Central orb, live transcript, waveform, barge-in support
 */
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Settings, Volume2, Volume1, Mic, MicOff, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import AetherOrb from '@/components/aether/AetherOrb';
import useAetherStore, { VOICE_STATE } from '@/lib/aetherStore';
import wsClient from '@/lib/wsClient';
import { formatDistanceToNow } from 'date-fns';

// ── Transcript Message ────────────────────────────────────────────────────────
function TranscriptMessage({ entry }) {
  const isUser = entry.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div
        className="max-w-xs rounded-2xl px-4 py-2.5"
        style={{
          background: isUser
            ? 'rgba(0, 212, 255, 0.12)'
            : 'var(--aether-surface-2)',
          border: isUser
            ? '1px solid rgba(0, 212, 255, 0.2)'
            : '1px solid var(--aether-border)',
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: isUser ? '#00D4FF' : '#E5E7EB' }}>
          {entry.text}
        </p>
      </div>
    </div>
  );
}

// ── Voice Settings Sheet ──────────────────────────────────────────────────────
function VoiceSettingsSheet({ onClose }) {
  const { settings, updateSettings } = useAetherStore();

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-5 animate-slide-up max-w-lg mx-auto"
        style={{
          background: 'var(--aether-surface)',
          border: '1px solid var(--aether-border)',
          borderBottom: 'none',
        }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--aether-border)' }} />
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-100">Voice Settings</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Voice speed */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Speed — {settings.voiceSpeed.toFixed(1)}x
            </label>
            <input
              type="range" min={0.5} max={2.0} step={0.1}
              value={settings.voiceSpeed}
              onChange={e => updateSettings({ voiceSpeed: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-cyan-400"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0.5x</span><span>2.0x</span>
            </div>
          </div>

          {/* Mic sensitivity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Mic Sensitivity — {Math.round(settings.micSensitivity * 100)}%
            </label>
            <input
              type="range" min={0} max={1} step={0.05}
              value={settings.micSensitivity}
              onChange={e => updateSettings({ micSensitivity: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-cyan-400"
            />
          </div>

          {/* Voice model */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Voice Model
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['alloy', 'nova', 'echo', 'onyx', 'shimmer', 'fable'].map(v => (
                <button
                  key={v}
                  onClick={() => updateSettings({ voiceModel: v })}
                  className="py-2 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: settings.voiceModel === v ? 'var(--aether-cyan-dim)' : 'var(--aether-surface-2)',
                    color: settings.voiceModel === v ? 'var(--aether-cyan)' : 'var(--aether-text-muted)',
                    border: `1px solid ${settings.voiceModel === v ? 'rgba(0,212,255,0.3)' : 'var(--aether-border)'}`,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Voice Mode ───────────────────────────────────────────────────────────
export default function VoiceMode() {
  const { voiceState, voiceTranscript, isVoiceActive } = useAetherStore();
  const [showSettings, setShowSettings] = useState(false);
  const transcriptRef = useRef(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [voiceTranscript]);

  const toggleVoice = () => {
    if (isVoiceActive) {
      wsClient.stopVoice();
    } else {
      wsClient.startVoice();
    }
  };

  const handleOrbTap = () => {
    if (voiceState === VOICE_STATE.SPEAKING) {
      wsClient.bargeIn();
    } else {
      toggleVoice();
    }
  };

  return (
    <div
      className="flex flex-col h-screen relative overflow-hidden"
      style={{ background: 'var(--aether-bg)' }}
    >
      {/* Ambient glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, 
            ${voiceState === VOICE_STATE.THINKING ? 'rgba(108,62,255,0.08)' :
              voiceState === VOICE_STATE.SPEAKING ? 'rgba(0,229,160,0.06)' :
              voiceState === VOICE_STATE.LISTENING ? 'rgba(0,212,255,0.07)' :
              'rgba(0,212,255,0.03)'} 0%, 
            transparent 70%)`,
          transition: 'background 1s ease',
        }}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 z-10">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--aether-text-muted)' }}
          aria-label="Back to Dashboard"
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Voice Mode
          </span>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          aria-label="Voice settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Central orb area */}
      <div className="flex-1 flex items-center justify-center z-10">
        <AetherOrb
          voiceState={voiceState}
          onClick={handleOrbTap}
          size={200}
          showLabel
          showWaveform
        />
      </div>

      {/* Controls */}
      <div className="px-6 pb-4 z-10">
        <div className="flex items-center justify-center gap-4 mb-4">
          {/* Mute/unmute */}
          <button
            onClick={toggleVoice}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: isVoiceActive ? 'rgba(0,212,255,0.12)' : 'var(--aether-surface-2)',
              border: `1px solid ${isVoiceActive ? 'rgba(0,212,255,0.3)' : 'var(--aether-border)'}`,
            }}
            aria-label={isVoiceActive ? 'Stop voice' : 'Start voice'}
          >
            {isVoiceActive
              ? <Mic size={20} style={{ color: 'var(--aether-cyan)' }} />
              : <MicOff size={20} style={{ color: 'var(--aether-text-muted)' }} />
            }
          </button>

          {/* Volume indicator */}
          <div className="flex items-center gap-1.5" style={{ color: 'var(--aether-text-muted)' }}>
            <Volume1 size={16} />
            <div className="flex gap-0.5 items-end h-4">
              {[4, 7, 5, 9, 6, 10, 7, 5, 4].map((h, i) => (
                <div
                  key={i}
                  className="w-0.5 rounded-full"
                  style={{
                    height: voiceState === VOICE_STATE.SPEAKING ? h : 4,
                    background: voiceState === VOICE_STATE.SPEAKING ? 'var(--aether-cyan)' : 'rgba(255,255,255,0.15)',
                    transition: 'height 0.1s ease',
                  }}
                />
              ))}
            </div>
            <Volume2 size={16} />
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div
        className="flex-shrink-0 border-t z-10"
        style={{
          borderColor: 'var(--aether-border)',
          maxHeight: '35vh',
        }}
      >
        {voiceTranscript.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-sm" style={{ color: 'var(--aether-text-dim)' }}>
              Tap the orb to start speaking
            </p>
          </div>
        ) : (
          <div
            ref={transcriptRef}
            className="overflow-y-auto px-4 py-3 space-y-2.5 scroll-fade-bottom"
            style={{ maxHeight: '35vh' }}
          >
            {voiceTranscript.map((entry, i) => (
              <TranscriptMessage key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Settings sheet */}
      {showSettings && <VoiceSettingsSheet onClose={() => setShowSettings(false)} />}
    </div>
  );
}