/**
 * Settings — Full configuration screen
 * Connection, LLM model, memory, voice, theme, danger zone
 */
import React, { useState } from 'react';
import {
  Wifi, Brain, Database, Mic, Palette, BookOpen, Download, AlertTriangle, Trash2, RefreshCw,
  ChevronRight, Check, Info, ExternalLink, ToggleLeft, ToggleRight
} from 'lucide-react';
import StatusBar from '@/components/aether/StatusBar';
import ConnectionSetup from '@/components/aether/ConnectionSetup';
import useAetherStore, { CONNECTION_STATUS } from '@/lib/aetherStore';
import wsClient from '@/lib/wsClient';
import { formatDistanceToNow } from 'date-fns';

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, iconColor = 'var(--aether-cyan)', children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={13} style={{ color: iconColor }} />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</h3>
      </div>
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--aether-surface)', border: '1px solid var(--aether-border)' }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, onClick, destructive, toggle, onToggle, rightEl }) {
  const content = (
    <div
      className={`flex items-center justify-between px-4 py-3.5 border-b last:border-0 transition-colors ${onClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
      style={{ borderColor: 'var(--aether-border)' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <span className={`text-sm ${destructive ? 'text-red-400' : 'text-gray-300'}`}>{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-500">{value}</span>}
        {rightEl}
        {toggle !== undefined && (
          <button onClick={e => { e.stopPropagation(); onToggle?.(); }} aria-label={toggle ? 'Disable' : 'Enable'}>
            {toggle
              ? <ToggleRight size={22} style={{ color: 'var(--aether-cyan)' }} />
              : <ToggleLeft size={22} className="text-gray-600" />
            }
          </button>
        )}
        {onClick && !toggle && (
          <ChevronRight size={15} className="text-gray-600" />
        )}
      </div>
    </div>
  );
  return content;
}

function Slider({ label, min, max, step, value, onChange, format }) {
  return (
    <div className="px-4 py-3.5 border-b last:border-0" style={{ borderColor: 'var(--aether-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm text-gray-500 font-mono-aether">{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-cyan-400"
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-gray-700 mt-1">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

// ── Danger Confirmation Modal ─────────────────────────────────────────────────
function DangerModal({ title, description, onConfirm, onCancel }) {
  const [confirmed, setConfirmed] = useState('');
  const CONFIRM_TEXT = 'CONFIRM';

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onCancel} />
      <div
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 p-5 rounded-2xl max-w-sm mx-auto animate-slide-up"
        style={{ background: 'var(--aether-surface)', border: '1px solid rgba(255,71,87,0.3)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
            <AlertTriangle size={17} className="text-red-400" />
          </div>
          <h3 className="font-bold text-gray-100 text-base">{title}</h3>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed mb-4">{description}</p>
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1.5">
            Type <strong className="text-gray-300">CONFIRM</strong> to proceed
          </label>
          <input
            type="text"
            value={confirmed}
            onChange={e => setConfirmed(e.target.value.toUpperCase())}
            placeholder="CONFIRM"
            className="input-aether w-full px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-surface py-2.5 rounded-xl text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={() => confirmed === CONFIRM_TEXT && onConfirm()}
            disabled={confirmed !== CONFIRM_TEXT}
            className="flex-1 btn-danger py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30"
          >
            Proceed
          </button>
        </div>
      </div>
    </>
  );
}

// ── Improvement Log ───────────────────────────────────────────────────────────
function ImprovementLog({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-gray-600">No lessons learned yet. Complete a reflection cycle to see improvements here.</p>
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry, i) => (
        <div
          key={i}
          className="px-4 py-3.5 border-b last:border-0"
          style={{ borderColor: 'var(--aether-border)' }}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span
              className="text-xs px-1.5 py-0.5 rounded capitalize"
              style={{ background: 'var(--aether-violet-dim)', color: '#9B5CFF' }}
            >
              {entry.category}
            </span>
            <span className="text-xs text-gray-600 flex-shrink-0">
              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{entry.lesson}</p>
          {entry.confidence && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${entry.confidence * 100}%`, background: '#9B5CFF' }}
                />
              </div>
              <span className="text-xs text-gray-600">{Math.round(entry.confidence * 100)}% confidence</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Settings ─────────────────────────────────────────────────────────────
export default function Settings() {
  const {
    settings, updateSettings, connectionStatus, connectedHost,
    improvementLog, completeOnboarding,
  } = useAetherStore();

  const [showConnection, setShowConnection] = useState(false);
  const [dangerAction, setDangerAction] = useState(null);
  const [showLog, setShowLog] = useState(false);

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  const handleModelSelect = (model) => {
    wsClient.selectModel(model);
  };

  const handleResetMemory = () => {
    wsClient.send('reset_memory', {});
    setDangerAction(null);
  };

  const handleFactoryReset = () => {
    wsClient.send('factory_reset', {});
    useAetherStore.getState().loadMockData();
    setDangerAction(null);
  };

  const handleExport = () => {
    wsClient.send('export_memory', {});
  };

  const FREQ_OPTIONS = ['hourly', 'daily', 'weekly', 'manual'];
  const THEME_OPTIONS = [
    { id: 'charcoal', label: 'Charcoal', desc: 'Deep charcoal' },
    { id: 'void', label: 'Void', desc: 'Pure black' },
    { id: 'abyss', label: 'Abyss', desc: 'Midnight blue' },
  ];

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--aether-bg)' }}>
      <StatusBar />

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--aether-text)', letterSpacing: '-0.02em' }}
          >
            Settings
          </h1>

          {/* ── Connection ── */}
          <Section title="Connection" icon={Wifi}>
            <Row
              label="Backend"
              value={connectedHost || 'Not connected'}
              onClick={() => setShowConnection(!showConnection)}
              rightEl={
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: isConnected ? '#00E5A0' : '#FF4757' }}
                />
              }
            />
            <Row
              label="Auto-Connect"
              toggle={settings.autoConnect}
              onToggle={() => updateSettings({ autoConnect: !settings.autoConnect })}
            />
            {showConnection && (
              <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--aether-border)' }}>
                <div className="mt-4">
                  <ConnectionSetup onConnected={() => setShowConnection(false)} />
                </div>
              </div>
            )}
          </Section>

          {/* ── LLM Model ── */}
          <Section title="Language Model" icon={Brain} iconColor="#9B5CFF">
            <div className="px-4 py-3">
              <p className="text-xs text-gray-500 mb-2">Active Ollama Model</p>
              {settings.availableModels.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Connect to Aether to see available models</p>
              ) : (
                <div className="space-y-1.5">
                  {settings.availableModels.map(model => (
                    <button
                      key={model}
                      onClick={() => handleModelSelect(model)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all"
                      style={{
                        background: settings.selectedModel === model ? 'var(--aether-cyan-dim)' : 'var(--aether-surface-2)',
                        border: `1px solid ${settings.selectedModel === model ? 'rgba(0,212,255,0.3)' : 'var(--aether-border)'}`,
                      }}
                    >
                      <span className="text-sm font-mono-aether" style={{ color: settings.selectedModel === model ? 'var(--aether-cyan)' : '#9CA3AF' }}>
                        {model}
                      </span>
                      {settings.selectedModel === model && <Check size={13} style={{ color: 'var(--aether-cyan)' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── Memory ── */}
          <Section title="Memory" icon={Database} iconColor="#00D4FF">
            <Slider
              label="Importance Threshold"
              min={0} max={1} step={0.05}
              value={settings.importanceThreshold}
              onChange={v => updateSettings({ importanceThreshold: v })}
              format={v => `${Math.round(v * 100)}%`}
            />
            <div className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--aether-border)' }}>
              <p className="text-sm text-gray-300 mb-2">Reflection Frequency</p>
              <div className="flex gap-1.5 flex-wrap">
                {FREQ_OPTIONS.map(f => (
                  <button
                    key={f}
                    onClick={() => updateSettings({ reflectionFrequency: f })}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={{
                      background: settings.reflectionFrequency === f ? 'var(--aether-cyan-dim)' : 'var(--aether-surface-2)',
                      color: settings.reflectionFrequency === f ? 'var(--aether-cyan)' : 'var(--aether-text-muted)',
                      border: `1px solid ${settings.reflectionFrequency === f ? 'rgba(0,212,255,0.3)' : 'var(--aether-border)'}`,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <Row label="Export Memory Backup" onClick={handleExport} rightEl={<Download size={14} className="text-gray-500" />} />
          </Section>

          {/* ── Voice ── */}
          <Section title="Voice" icon={Mic} iconColor="#00E5A0">
            <Slider
              label="Voice Speed"
              min={0.5} max={2} step={0.1}
              value={settings.voiceSpeed}
              onChange={v => updateSettings({ voiceSpeed: v })}
              format={v => `${v.toFixed(1)}x`}
            />
            <Slider
              label="Mic Sensitivity"
              min={0} max={1} step={0.05}
              value={settings.micSensitivity}
              onChange={v => updateSettings({ micSensitivity: v })}
              format={v => `${Math.round(v * 100)}%`}
            />
          </Section>

          {/* ── Theme ── */}
          <Section title="Appearance" icon={Palette} iconColor="#FFB347">
            <div className="px-4 py-3">
              <div className="flex gap-2">
                {THEME_OPTIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => updateSettings({ theme: t.id })}
                    className="flex-1 py-2.5 rounded-xl text-center transition-all"
                    style={{
                      background: settings.theme === t.id ? 'var(--aether-cyan-dim)' : 'var(--aether-surface-2)',
                      border: `1px solid ${settings.theme === t.id ? 'rgba(0,212,255,0.3)' : 'var(--aether-border)'}`,
                    }}
                  >
                    <p className={`text-xs font-semibold ${settings.theme === t.id ? 'text-cyan-400' : 'text-gray-400'}`}>
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Self-Improvement Log ── */}
          <Section title="Self-Improvement Log" icon={BookOpen} iconColor="#9B5CFF">
            <Row
              label={`${improvementLog.length} lessons learned`}
              onClick={() => setShowLog(!showLog)}
            />
            {showLog && <ImprovementLog entries={improvementLog} />}
          </Section>

          {/* ── About ── */}
          <Section title="About" icon={Info}>
            <Row label="Version" value="1.0.0 Genesis Build" />
            <Row label="Aether Philosophy" onClick={() => {}} rightEl={<ExternalLink size={13} className="text-gray-600" />} />
            <Row label="Privacy Policy" onClick={() => {}} rightEl={<ExternalLink size={13} className="text-gray-600" />} />
          </Section>

          {/* ── Danger Zone ── */}
          <Section title="Danger Zone" icon={AlertTriangle} iconColor="#FF4757">
            <Row
              label="Reset Memory"
              destructive
              onClick={() => setDangerAction('reset_memory')}
            />
            <Row
              label="Factory Reset Aether"
              destructive
              onClick={() => setDangerAction('factory_reset')}
            />
          </Section>
        </div>
      </div>

      {/* Danger modals */}
      {dangerAction === 'reset_memory' && (
        <DangerModal
          title="Reset Memory"
          description="This will permanently delete all of Aether's episodic memories, reflections, and lessons. This cannot be undone."
          onConfirm={handleResetMemory}
          onCancel={() => setDangerAction(null)}
        />
      )}
      {dangerAction === 'factory_reset' && (
        <DangerModal
          title="Factory Reset Aether"
          description="This will reset Aether to its default state — all memory, learning, and configuration will be permanently deleted. This cannot be undone."
          onConfirm={handleFactoryReset}
          onCancel={() => setDangerAction(null)}
        />
      )}
    </div>
  );
}