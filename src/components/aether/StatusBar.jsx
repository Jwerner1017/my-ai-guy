/**
 * Aether Status Bar — persistent connection status shown in all main screens
 */
import React from 'react';
import { Wifi, WifiOff, Loader2, Zap } from 'lucide-react';
import useAetherStore, { CONNECTION_STATUS } from '@/lib/aetherStore';

const statusConfig = {
  [CONNECTION_STATUS.CONNECTED]: {
    label: 'Live',
    icon: Wifi,
    dotClass: 'status-online',
    textClass: 'text-emerald-400',
    showActivity: true,
  },
  [CONNECTION_STATUS.CONNECTING]: {
    label: 'Connecting…',
    icon: Loader2,
    dotClass: 'status-connecting',
    textClass: 'text-amber-400',
    iconSpin: true,
    showActivity: false,
  },
  [CONNECTION_STATUS.SEARCHING]: {
    label: 'Searching…',
    icon: Loader2,
    dotClass: 'status-connecting',
    textClass: 'text-amber-400',
    iconSpin: true,
    showActivity: false,
  },
  [CONNECTION_STATUS.DISCONNECTED]: {
    label: 'Offline',
    icon: WifiOff,
    dotClass: 'status-offline',
    textClass: 'text-red-400',
    showActivity: false,
  },
  [CONNECTION_STATUS.ERROR]: {
    label: 'Error',
    icon: WifiOff,
    dotClass: 'status-offline',
    textClass: 'text-red-400',
    showActivity: false,
  },
  [CONNECTION_STATUS.IDLE]: {
    label: 'Not Connected',
    icon: WifiOff,
    dotClass: 'bg-gray-600',
    textClass: 'text-gray-500',
    showActivity: false,
  },
};

export default function StatusBar({ compact = false }) {
  const { connectionStatus, currentActivity, connectedHost, tokenUsage } = useAetherStore();
  const config = statusConfig[connectionStatus] || statusConfig[CONNECTION_STATUS.IDLE];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotClass}`} />
        <span className={`text-xs font-medium ${config.textClass}`}>{config.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b"
         style={{ borderColor: 'var(--aether-border)', background: 'var(--aether-surface)', paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>

      {/* Left: Status + Activity */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Status dot */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${config.dotClass}`} />
          <Icon
            size={13}
            className={`${config.textClass} ${config.iconSpin ? 'animate-spin' : ''}`}
          />
          <span className={`text-xs font-semibold tracking-wide ${config.textClass}`}>
            {config.label}
          </span>
        </div>

        {/* Divider */}
        {config.showActivity && currentActivity && (
          <>
            <div className="w-px h-3 bg-white/10 flex-shrink-0" />
            <span className="text-xs text-gray-500 truncate">
              {currentActivity}
            </span>
          </>
        )}

        {/* Offline host */}
        {!config.showActivity && connectedHost && (
          <>
            <div className="w-px h-3 bg-white/10 flex-shrink-0" />
            <span className="text-xs text-gray-600 truncate">
              Last: {connectedHost}
            </span>
          </>
        )}
      </div>

      {/* Right: Token usage */}
      {connectionStatus === CONNECTION_STATUS.CONNECTED && tokenUsage.total > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Zap size={11} className="text-cyan-500" />
          <span className="font-mono-aether text-xs text-gray-500">
            {(tokenUsage.total / 1000).toFixed(1)}k
          </span>
        </div>
      )}
    </div>
  );
}