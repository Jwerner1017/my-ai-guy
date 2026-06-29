/**
 * Tools & Approvals — Manage tool approval queue and history
 */
import React, { useState } from 'react';
import { Wrench, Clock, CheckCircle, XCircle, Shield, AlertTriangle, AlertOctagon, History } from 'lucide-react';
import StatusBar from '@/components/aether/StatusBar';
import ApprovalModal from '@/components/aether/ApprovalModal';
import useAetherStore from '@/lib/aetherStore';
import wsClient from '@/lib/wsClient';
import { formatDistanceToNow } from 'date-fns';

const RISK_COLORS = {
  low: { color: '#00E5A0', bg: 'rgba(0,229,160,0.08)', border: 'rgba(0,229,160,0.2)', Icon: Shield },
  medium: { color: '#FFB347', bg: 'rgba(255,179,71,0.08)', border: 'rgba(255,179,71,0.2)', Icon: AlertTriangle },
  high: { color: '#FF4757', bg: 'rgba(255,71,87,0.08)', border: 'rgba(255,71,87,0.2)', Icon: AlertOctagon },
};

// ── Pending Approval Card ─────────────────────────────────────────────────────
function PendingCard({ approval, onReview }) {
  const risk = RISK_COLORS[approval.riskLevel] || RISK_COLORS.medium;
  const RiskIcon = risk.Icon;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--aether-surface)',
        border: '1px solid rgba(255,71,87,0.2)',
        boxShadow: '0 0 20px rgba(255,71,87,0.06)',
      }}
    >
      {/* Pulsing top border */}
      <div className="h-0.5 w-full" style={{ background: risk.color, opacity: 0.6 }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: risk.bg, border: `1px solid ${risk.border}` }}
            >
              <Wrench size={15} style={{ color: risk.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-100 truncate">{approval.toolName}</p>
              <p className="text-xs text-gray-600">
                {formatDistanceToNow(new Date(approval.timestamp), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div
            className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
            style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}
          >
            <RiskIcon size={10} />
            {approval.riskLevel}
          </div>
        </div>

        {/* Action */}
        <p className="text-xs font-mono-aether text-gray-400 mb-2 leading-relaxed line-clamp-2">
          {approval.action}
        </p>

        {/* Reason */}
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-4">
          "{approval.reason}"
        </p>

        {/* Quick buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => wsClient.approveAction(approval.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold btn-cyan"
          >
            <CheckCircle size={13} /> Approve
          </button>
          <button
            onClick={onReview}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold btn-surface"
          >
            Review Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ── History Item ──────────────────────────────────────────────────────────────
function HistoryItem({ item }) {
  const isApproved = item.outcome === 'approved';

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'var(--aether-surface)', border: '1px solid var(--aether-border)' }}
    >
      {isApproved
        ? <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
        : <XCircle size={15} className="text-red-400 flex-shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 truncate">{item.toolName}</p>
        <p className="text-xs text-gray-600">
          {formatDistanceToNow(new Date(item.resolvedAt || item.timestamp), { addSuffix: true })}
          {item.reason ? ` · ${item.reason}` : ''}
        </p>
      </div>
      <div
        className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize"
        style={{
          background: isApproved ? 'rgba(0,229,160,0.08)' : 'rgba(255,71,87,0.08)',
          color: isApproved ? '#00E5A0' : '#FF4757',
        }}
      >
        {item.outcome}
      </div>
    </div>
  );
}

// ── Empty Queue ───────────────────────────────────────────────────────────────
function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}
      >
        <Shield size={24} style={{ color: '#00E5A0' }} />
      </div>
      <h3 className="font-semibold text-gray-300 mb-2">All Clear</h3>
      <p className="text-sm text-gray-600 max-w-xs">
        No pending tool approvals. Aether will notify you here when it needs permission.
      </p>
    </div>
  );
}

// ── Main Tools & Approvals ────────────────────────────────────────────────────
export default function ToolsApprovals() {
  const { pendingApprovals, approvalHistory } = useAetherStore();
  const [activeApproval, setActiveApproval] = useState(null);
  const [activeTab, setActiveTab] = useState('queue');

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--aether-bg)' }}>
      <StatusBar />

      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--aether-text)', letterSpacing: '-0.02em' }}
            >
              Tools
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--aether-text-muted)' }}>
              {pendingApprovals.length > 0
                ? `${pendingApprovals.length} pending approval${pendingApprovals.length > 1 ? 's' : ''}`
                : 'No pending actions'}
            </p>
          </div>

          {pendingApprovals.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(255,71,87,0.12)',
                border: '1px solid rgba(255,71,87,0.25)',
              }}
            >
              <Clock size={13} style={{ color: '#FF4757' }} />
              <span className="text-xs font-bold" style={{ color: '#FF4757' }}>
                {pendingApprovals.length}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'var(--aether-surface-2)' }}
          role="tablist"
        >
          {[
            { id: 'queue', label: 'Queue', icon: Wrench, count: pendingApprovals.length },
            { id: 'history', label: 'History', icon: History, count: approvalHistory.length },
          ].map(tab => {
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
                }}
              >
                <Icon size={12} />
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="min-w-4 h-4 rounded-full flex items-center justify-center text-xs px-1"
                    style={{
                      background: tab.id === 'queue' && pendingApprovals.length > 0 ? '#FF4757' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="space-y-3 max-w-2xl mx-auto">

          {activeTab === 'queue' && (
            <>
              {pendingApprovals.length === 0 ? (
                <EmptyQueue />
              ) : (
                pendingApprovals.map(approval => (
                  <PendingCard
                    key={approval.id}
                    approval={approval}
                    onReview={() => setActiveApproval(approval)}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'history' && (
            <>
              {approvalHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History size={28} className="text-gray-600 mb-3" />
                  <p className="text-sm text-gray-600">No approval history yet</p>
                </div>
              ) : (
                approvalHistory.map((item, i) => (
                  <HistoryItem key={i} item={item} />
                ))
              )}
            </>
          )}
        </div>
      </div>

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