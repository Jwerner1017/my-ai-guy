/**
 * Dashboard — Mission control home screen
 * Live status, goal input, reasoning trace, quick actions, system stats
 */
import React, { useState, useEffect } from 'react';
import { Brain, Database, Mic, Wrench, RefreshCw, Zap, TrendingUp, ChevronRight, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import StatusBar from '@/components/aether/StatusBar';
import GoalInput from '@/components/aether/GoalInput';
import ReasoningTrace from '@/components/aether/ReasoningTrace';
import ApprovalModal from '@/components/aether/ApprovalModal';
import PullToRefresh from '@/components/aether/PullToRefresh';
import useAetherStore, { CONNECTION_STATUS } from '@/lib/aetherStore';
import wsClient from '@/lib/wsClient';
import { formatDistanceToNow } from 'date-fns';

// ── Quick Action Button ───────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, badge, onClick, to, color = '#00D4FF' }) {
  const content = (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-2xl relative group transition-all duration-200"
      style={{
        background: 'var(--aether-surface)',
        border: '1px solid var(--aether-border)',
        flex: 1,
        minWidth: 0,
      }}
      aria-label={label}
    >
      {badge > 0 && (
        <div
          className="absolute -top-1.5 -right-1.5 min-w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold px-1"
          style={{ background: '#FF4757', color: '#fff' }}
        >
          {badge > 9 ? '9+' : badge}
        </div>
      )}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
        style={{ background: `${color}15`, border: `1px solid ${color}25` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <span className="text-xs font-medium text-center leading-tight" style={{ color: 'var(--aether-text-muted)' }}>
        {label}
      </span>
    </button>
  );

  if (to) return <Link to={to} className="flex-1 min-w-0">{content}</Link>;
  return <div className="flex-1 min-w-0">{content}</div>;
}

// ── System Stats Row ──────────────────────────────────────────────────────────
function SystemStats() {
  const { tokenUsage, memoryCount } = useAetherStore();

  return (
    <div className="flex gap-3">
      {/* Token usage */}
      <div
        className="flex-1 p-3 rounded-xl"
        style={{ background: 'var(--aether-surface)', border: '1px solid var(--aether-border)' }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Zap size={11} style={{ color: 'var(--aether-cyan)' }} />
          <span className="text-xs text-gray-500 font-medium">Tokens Used</span>
        </div>
        <p className="font-mono-aether font-semibold text-sm text-gray-200">
          {tokenUsage.total > 0 ? `${(tokenUsage.total / 1000).toFixed(1)}k` : '—'}
        </p>
        {tokenUsage.total > 0 && (
          <div className="flex gap-1 mt-1.5">
            <div className="flex-1 h-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.3)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(tokenUsage.input / tokenUsage.total) * 100}%`,
                  background: 'var(--aether-cyan)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Memory count */}
      <div
        className="flex-1 p-3 rounded-xl"
        style={{ background: 'var(--aether-surface)', border: '1px solid var(--aether-border)' }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp size={11} style={{ color: '#9B5CFF' }} />
          <span className="text-xs text-gray-500 font-medium">Memories</span>
        </div>
        <p className="font-mono-aether font-semibold text-sm text-gray-200">
          {memoryCount || '—'}
        </p>
        <p className="text-xs text-gray-600 mt-1">stored</p>
      </div>
    </div>
  );
}

// ── Recent Goals ──────────────────────────────────────────────────────────────
function RecentGoals() {
  const { recentGoals } = useAetherStore();

  if (recentGoals.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Recent Goals</h3>
      <div className="space-y-2">
        {recentGoals.slice(0, 3).map(goal => (
          <div
            key={goal.id}
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'var(--aether-surface)', border: '1px solid var(--aether-border)' }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: goal.status === 'complete' ? '#00E5A0' : 'var(--aether-cyan)',
              }}
            />
            <p className="text-sm text-gray-300 flex-1 truncate">{goal.text}</p>
            <span className="text-xs text-gray-600 flex-shrink-0">
              {formatDistanceToNow(new Date(goal.createdAt), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty State (offline) ─────────────────────────────────────────────────────
function OfflineState() {
  const { lastSeenAt } = useAetherStore();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.15)' }}
      >
        <Brain size={28} style={{ color: '#FF4757' }} />
      </div>
      <h3 className="font-semibold text-gray-300 mb-2">Aether is Offline</h3>
      <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
        {lastSeenAt
          ? `Last connected ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}. Trying to reconnect…`
          : 'No connection to the Aether backend. Check that Docker is running on your computer.'
        }
      </p>
      <Link
        to="/settings"
        className="mt-4 text-sm font-medium flex items-center gap-1"
        style={{ color: 'var(--aether-cyan)' }}
      >
        Manage connection <ChevronRight size={14} />
      </Link>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const {
    connectionStatus,
    executionNodes,
    isExecuting,
    pendingApprovals,
  } = useAetherStore();

  const [activeApproval, setActiveApproval] = useState(null);
  const [traceCollapsed, setTraceCollapsed] = useState(false);

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  // Show newest pending approval
  useEffect(() => {
    if (pendingApprovals.length > 0 && !activeApproval) {
      setActiveApproval(pendingApprovals[0]);
    }
    if (pendingApprovals.length === 0) {
      setActiveApproval(null);
    }
  }, [pendingApprovals]);

  const handleGoalSubmit = (goal) => {
    navigate('/goals');
  };

  const handleTriggerReflection = () => {
    wsClient.triggerReflection();
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: 'var(--aether-bg)' }}
    >
      {/* Status Bar */}
      <StatusBar />

      {/* Scrollable content with pull-to-refresh */}
      <PullToRefresh onRefresh={() => wsClient.fetchStatus?.()}>
        <div className="px-4 pt-5 pb-24 space-y-5 max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: 'var(--aether-text)', letterSpacing: '-0.02em' }}
              >
                Mission Control
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--aether-text-muted)' }}>
                {isConnected ? 'Aether is ready' : 'Awaiting connection'}
              </p>
            </div>

            {/* Pending approvals badge */}
            {pendingApprovals.length > 0 && (
              <button
                onClick={() => setActiveApproval(pendingApprovals[0])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(255,71,87,0.12)',
                  border: '1px solid rgba(255,71,87,0.25)',
                  animation: 'pulse-warning 1.5s ease-in-out infinite',
                }}
                aria-label={`${pendingApprovals.length} pending approvals`}
              >
                <Bell size={13} style={{ color: '#FF4757' }} />
                <span className="text-xs font-semibold" style={{ color: '#FF4757' }}>
                  {pendingApprovals.length} Pending
                </span>
              </button>
            )}
          </div>

          {/* Goal Input (only when connected) */}
          {isConnected ? (
            <GoalInput onGoalSubmit={handleGoalSubmit} />
          ) : (
            <OfflineState />
          )}

          {/* Quick actions */}
          {isConnected && (
            <div className="flex gap-3">
              <QuickAction
                icon={RefreshCw}
                label="Reflect"
                onClick={handleTriggerReflection}
                color="#9B5CFF"
              />
              <QuickAction
                icon={Database}
                label="Memory"
                to="/memory"
                color="#00D4FF"
              />
              <QuickAction
                icon={Mic}
                label="Voice"
                to="/voice"
                color="#00E5A0"
              />
              <QuickAction
                icon={Wrench}
                label="Tools"
                to="/tools"
                badge={pendingApprovals.length}
                color="#FFB347"
              />
            </div>
          )}

          {/* Live Reasoning Trace */}
          {isConnected && (executionNodes.length > 0 || isExecuting) && (
            <div
              className="p-4 rounded-2xl"
              style={{
                background: 'var(--aether-surface)',
                border: '1px solid var(--aether-border)',
              }}
            >
              <ReasoningTrace
                nodes={executionNodes}
                collapsed={traceCollapsed}
                onToggle={() => setTraceCollapsed(!traceCollapsed)}
              />
            </div>
          )}

          {/* System stats */}
          {isConnected && <SystemStats />}

          {/* Recent goals */}
          {isConnected && <RecentGoals />}
        </div>
      </PullToRefresh>

      {/* Approval Modal */}
      {activeApproval && (
        <ApprovalModal
          approval={activeApproval}
          onClose={() => setActiveApproval(null)}
        />
      )}
    </div>
  );
}