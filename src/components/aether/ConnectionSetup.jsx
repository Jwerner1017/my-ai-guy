/**
 * Connection Setup Component
 * Three methods: Auto-discovery, Manual IP entry, QR code scan
 */
import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Search, QrCode, ChevronRight, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { discoverAetherInstances, probeSpecificHost, parseAetherQRCode } from '@/lib/mdnsDiscovery';
import wsClient from '@/lib/wsClient';
import useAetherStore from '@/lib/aetherStore';

const TABS = [
  { id: 'auto', label: 'Auto-Discover', icon: Search },
  { id: 'manual', label: 'Manual', icon: Wifi },
  { id: 'qr', label: 'QR Code', icon: QrCode },
];

// ── Auto Discovery Tab ────────────────────────────────────────────────────────
function AutoDiscoveryTab({ onConnect }) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ scanned: 0, total: 0, found: 0 });
  const [found, setFound] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const startScan = async () => {
    setScanning(true);
    setFound([]);
    setError(null);
    setProgress({ scanned: 0, total: 0, found: 0 });

    abortRef.current = new AbortController();

    try {
      const results = await discoverAetherInstances(
        (p) => setProgress({ scanned: p.scanned, total: p.total, found: p.found }),
        abortRef.current.signal
      );
      setFound(results);
      if (results.length === 0) {
        setError('No Aether instances found on your local network. Try manual entry.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    startScan();
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="space-y-4">
      {/* Scan status */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--aether-surface-2)', border: '1px solid var(--aether-border)' }}
      >
        {scanning ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="text-cyan-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">Scanning local network…</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Checked {progress.scanned} of {progress.total || '–'} addresses
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: progress.total ? `${(progress.scanned / progress.total) * 100}%` : '0%',
                  background: 'var(--aether-cyan)',
                }}
              />
            </div>
          </div>
        ) : error ? (
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-300">{error}</p>
              <button onClick={startScan} className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 flex items-center gap-1">
                <RefreshCw size={11} /> Try again
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-emerald-400" />
            <p className="text-sm text-gray-300">
              Scan complete — found {found.length} instance{found.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Found instances */}
      {found.map(instance => (
        <button
          key={instance.address}
          onClick={() => onConnect(instance.host, instance.port)}
          className="w-full flex items-center justify-between p-4 rounded-xl text-left group transition-all duration-200"
          style={{
            background: 'var(--aether-surface)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.05)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--aether-cyan-dim)' }}
            >
              <Wifi size={18} style={{ color: 'var(--aether-cyan)' }} />
            </div>
            <div>
              <p className="font-semibold text-gray-100 text-sm">{instance.name}</p>
              <p className="text-xs text-gray-500">{instance.address} · {instance.model}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
        </button>
      ))}

      {!scanning && found.length === 0 && !error && (
        <button onClick={startScan} className="w-full btn-surface py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
          <RefreshCw size={14} /> Rescan Network
        </button>
      )}
    </div>
  );
}

// ── Manual Entry Tab ──────────────────────────────────────────────────────────
function ManualEntryTab({ onConnect }) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8765');
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    if (!host.trim()) return;
    setProbing(true);
    setError(null);

    try {
      const result = await probeSpecificHost(host.trim(), port.trim() || '8765');
      if (result) {
        onConnect(host.trim(), port.trim() || '8765');
      } else {
        setError(`Cannot reach Aether at ${host}:${port}. Check the address and that Aether is running.`);
      }
    } catch {
      setError('Connection failed. Check the host and port.');
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="aether-host" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Host / IP Address
        </label>
        <input
          id="aether-host"
          type="text"
          value={host}
          onChange={e => setHost(e.target.value)}
          placeholder="192.168.1.42 or localhost"
          className="input-aether w-full px-3 py-2.5 text-sm"
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="aether-port" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Port
        </label>
        <input
          id="aether-port"
          type="text"
          value={port}
          onChange={e => setPort(e.target.value)}
          placeholder="8765"
          className="input-aether w-full px-3 py-2.5 text-sm"
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)' }}>
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={!host.trim() || probing}
        className="w-full btn-cyan py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {probing ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
        {probing ? 'Checking…' : 'Connect'}
      </button>
    </div>
  );
}

// ── QR Code Tab ───────────────────────────────────────────────────────────────
function QRCodeTab({ onConnect }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // For web: read QR from image using a simple text input fallback
    // In a real mobile app, use expo-camera
    setError('QR scanning requires the native mobile app. Use manual entry or paste the connection string below.');
  };

  const [pastedQR, setPastedQR] = useState('');

  const handleParse = () => {
    try {
      const parsed = parseAetherQRCode(pastedQR.trim());
      if (parsed.host) {
        onConnect(parsed.host, parsed.port);
      } else {
        setError('Invalid QR code content.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* QR illustration */}
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: 'var(--aether-surface-2)', border: '1px solid var(--aether-border)' }}
      >
        <QrCode size={48} className="mx-auto mb-3" style={{ color: 'var(--aether-text-muted)' }} />
        <p className="text-sm text-gray-400 mb-1">Scan from Aether Desktop</p>
        <p className="text-xs text-gray-600">Open Aether on your computer → Settings → Show QR Code</p>
      </div>

      {/* Paste fallback */}
      <div>
        <label htmlFor="qr-paste" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Or paste connection string
        </label>
        <input
          id="qr-paste"
          type="text"
          value={pastedQR}
          onChange={e => setPastedQR(e.target.value)}
          placeholder="aether://connect?host=…&port=8765"
          className="input-aether w-full px-3 py-2.5 text-sm font-mono-aether"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)' }}>
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handleParse}
        disabled={!pastedQR.trim()}
        className="w-full btn-cyan py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
      >
        Connect via QR
      </button>
    </div>
  );
}

// ── Main ConnectionSetup ──────────────────────────────────────────────────────
export default function ConnectionSetup({ onConnected }) {
  const [activeTab, setActiveTab] = useState('auto');
  const [connecting, setConnecting] = useState(false);
  const { updateSettings } = useAetherStore();

  const handleConnect = async (host, port = '8765') => {
    setConnecting(true);
    updateSettings({ savedHost: host, savedPort: port });
    wsClient.connect(host, port);

    // Wait a moment and check status
    await new Promise(r => setTimeout(r, 1500));
    setConnecting(false);
    onConnected?.();
  };

  if (connecting) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center animate-breathe"
          style={{ background: 'var(--aether-cyan-dim)', border: '1px solid rgba(0,212,255,0.3)' }}
        >
          <Loader2 size={28} style={{ color: 'var(--aether-cyan)' }} className="animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-200">Connecting to Aether…</p>
          <p className="text-sm text-gray-500 mt-1">Establishing secure local connection</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ background: 'var(--aether-surface-2)' }}
        role="tablist"
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                background: activeTab === tab.id ? 'var(--aether-surface)' : 'transparent',
                color: activeTab === tab.id ? 'var(--aether-cyan)' : 'var(--aether-text-muted)',
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'auto' && <AutoDiscoveryTab onConnect={handleConnect} />}
      {activeTab === 'manual' && <ManualEntryTab onConnect={handleConnect} />}
      {activeTab === 'qr' && <QRCodeTab onConnect={handleConnect} />}
    </div>
  );
}