/**
 * Goal Execution — Full-screen execution view
 * Animated graph, live nodes, pause/interrupt, approval modal
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Pause, Play, Square, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReasoningTrace from '@/components/aether/ReasoningTrace';
import ApprovalModal from '@/components/aether/ApprovalModal';
import useAetherStore, { NODE_STATUS, CONNECTION_STATUS } from '@/lib/aetherStore';
import wsClient from '@/lib/wsClient';
import { formatDistanceToNow } from 'date-fns';

// ── Goal Status Badge ─────────────────────────────────────────────────────────
function GoalStatusBadge({ isExecuting, executionPaused, hasNodes }) {
  if (isExecuting && executionPaused) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full tag-warning text-xs font-semibold">
        <Pause size={11} /> Paused
      </div>
    );
  }
  if (isExecuting) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full tag-cyan text-xs font-semibold">
        <Loader2 size={11} className="animate-spin" /> Running
      </div>
    );
  }
  if (hasNodes) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full tag-success text-xs font-semibold">
        <CheckCircle size={11} /> Complete
      </div>
    );
  }
  return null;
}

// ── Execution Controls ────────────────────────────────────────────────────────
function ExecutionControls({ isExecuting, isPaused, onPause, onResume, onInterrupt }) {
  if (!isExecuting) return null;

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-30 flex gap-3 p-4 rounded-2xl max-w-xl mx-auto"
      style={{
        background: 'var(--aether-surface)',
        border: '1px solid var(--aether-border)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Pause / Resume */}
      {isPaused ? (
        <button
          onClick={onResume}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm btn-cyan"
        >
          <Play size={16} /> Resume
        </button>
      ) : (
        <button
          onClick={onPause}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm btn-surface"
        >
          <Pause size={16} /> Pause
        </button>
      )}

      {/* Interrupt */}
      <button
        onClick={onInterrupt}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm btn-danger"
      >
        <Square size={14} /> Interrupt
      </button>
    </div>
  );
}

// ── Streaming Log ─────────────────────────────────────────────────────────────
function StreamingLog({ lines, visible }) {
  if (!visible || lines.length === 0) return null;

  const lastLines = lines.slice(-5);

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-2">Stream</p>
      <div className="space-y-0.5">
        {lastLines.map((line, i) => (
          <p
            key={i}
            className="font-mono-aether text-xs leading-relaxed"
            style={{
              color: i === lastLines.length - 1 ? '#9CA3AF' : '#4B5563',
            }}
          >
            {line}
          </p>
        ))}
        {/* Blinking cursor */}
        <span
          className="inline-block w-1.5 h-3 rounded-sm"
          style={{
            background: 'var(--aether-cyan)',
            animation: 'orbPulse 1s step-end infinite',
          }}
        />
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function NoGoalState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--aether-cyan-dim)', border: '1px solid rgba(0,212,255,0.2)' }}
      >
        <Clock size={28} style={{ color: 'var(--aether-cyan)' }} />
      </div>
      <h3 className="font-semibold text-gray-300 mb-2">No Active Goal</h3>
      <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
        Submit a goal from the Dashboard to start execution. Aether will plan, retrieve relevant memories, and execute step by step.
      </p>
      <Link to="/" className="mt-5 btn-cyan px-6 py-2.5 rounded-xl text-sm font-semibold">
        Back to Dashboard
      </Link>
    </div>
  );
}

// ── Main Goal Execution ───────────────────────────────────────────────────────
export default function GoalExecution() {
  const {
    activeGoal,
    isExecuting,
    executionPaused,
    executionNodes,
    executionLog,
    pendingApprovals,
    connectionStatus,
  } = useAetherStore();

  const [activeApproval, setActiveApproval] = useState(null);
  const [showLog, setShowLog] = useState(false);

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  // Prompt the first pending approval
  useEffect(() => {
    if (pendingApprovals.length > 0 && !activeApproval) {
      setActiveApproval(pendingApprovals[0]);
    }
    if (pendingApprovals.length === 0) setActiveApproval(null);
  }, [pendingApprovals]);

  const handlePause = () => wsClient.pauseGoal();
  const handleResume = () => wsClient.resumeGoal();
  const handleInterrupt = () => {
    if (window.confirm('Interrupt execution? Aether will stop immediately.')) {
      wsClient.interruptGoal();
    }
  };

  const completedNodes = executionNodes.filter(n => n.status === NODE_STATUS.COMPLETE).length;
  const totalNodes = executionNodes.length;

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: 'var(--aether-bg)' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--aether-border)', background: 'var(--aether-surface)' }}
      >
        <Link to="/" className="text-gray-500 hover:text-gray-300 transition-colors" aria-label="Back">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-200 truncate">
            {activeGoal?.text || 'Goal Execution'}
          </h2>
          {activeGoal?.createdAt && (
            <p className="text-xs text-gray-600">
              Started {formatDistanceToNow(new Date(activeGoal.createdAt), { addSuffix: true })}
            </p>
          )}
        </div>
        <GoalStatusBadge
          isExecuting={isExecuting}
          executionPaused={executionPaused}
          hasNodes={executionNodes.length > 0}
        />
      </div>

      {/* Progress bar */}
      {totalNodes > 0 && (
        <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: totalNodes ? `${(completedNodes / Math.max(totalNodes, 4)) * 100}%` : '0%',
              background: 'linear-gradient(90deg, var(--aether-cyan), var(--aether-violet))',
            }}
          />
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {!activeGoal && !isExecuting ? (
          <NoGoalState />
        ) : (
          <div className="px-4 pt-4 pb-36 space-y-4 max-w-2xl mx-auto">

            {/* Pending approvals alert */}
            {pendingApprovals.length > 0 && (
              <button
                onClick={() => setActiveApproval(pendingApprovals[0])}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
                style={{
                  background: 'rgba(255,71,87,0.08)',
                  border: '1px solid rgba(255,71,87,0.25)',
                  animation: 'pulse-warning 1.5s ease-in-out infinite',
                }}
              >
                <AlertCircle size={16} style={{ color: '#FF4757' }} />
                <span className="text-sm font-semibold text-red-400">
                  Aether needs your approval — tap to review
                </span>
              </button>
            )}

            {/* Reasoning trace */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--aether-surface)',
                border: '1px solid var(--aether-border)',
              }}
            >
              <div className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                  Reasoning Trace
                </h3>
                <ReasoningTrace nodes={executionNodes} />
              </div>
            </div>

            {/* Streaming log toggle */}
            {executionLog.length > 0 && (
              <div>
                <button
                  onClick={() => setShowLog(!showLog)}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-2 flex items-center gap-1"
                >
                  {showLog ? '▾' : '▸'} Raw stream ({executionLog.length} tokens)
                </button>
                <StreamingLog lines={executionLog} visible={showLog} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Execution controls */}
      <ExecutionControls
        isExecuting={isExecuting}
        isPaused={executionPaused}
        onPause={handlePause}
        onResume={handleResume}
        onInterrupt={handleInterrupt}
      />

      {/* Approval modal */}
      {activeApproval && (
        <ApprovalModal
          approval={activeApproval}
          onClose={() => setActiveApproval(null)}
        />
      )}
    </div>
  );
}