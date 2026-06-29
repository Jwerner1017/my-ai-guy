/**
 * Tool Approval Modal
 * Slides up when Aether needs human approval to use a tool.
 * Shows what the tool wants to do, why, and risk level.
 */
import React, { useState } from 'react';
import { X, Shield, AlertTriangle, AlertOctagon, Check, XCircle, ChevronRight } from 'lucide-react';
import wsClient from '@/lib/wsClient';

const RISK_CONFIG = {
  low: {
    label: 'Low Risk',
    icon: Shield,
    class: 'tag-success',
    barColor: '#00E5A0',
    description: 'This action is safe and reversible.',
  },
  medium: {
    label: 'Medium Risk',
    icon: AlertTriangle,
    class: 'tag-warning',
    barColor: '#FFB347',
    description: 'Review carefully before approving.',
  },
  high: {
    label: 'High Risk',
    icon: AlertOctagon,
    class: 'tag-danger',
    barColor: '#FF4757',
    description: 'This action may be irreversible. Approve only if certain.',
  },
};

function ApprovalCard({ approval, onClose }) {
  const [denyReason, setDenyReason] = useState('');
  const [showDenyInput, setShowDenyInput] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const risk = RISK_CONFIG[approval.riskLevel] || RISK_CONFIG.medium;
  const RiskIcon = risk.icon;

  const handleApprove = async () => {
    setIsResolving(true);
    wsClient.approveAction(approval.id);
    setTimeout(() => { setIsResolving(false); onClose(); }, 300);
  };

  const handleDeny = async () => {
    if (!showDenyInput) {
      setShowDenyInput(true);
      return;
    }
    setIsResolving(true);
    wsClient.denyAction(approval.id, denyReason);
    setTimeout(() => { setIsResolving(false); onClose(); }, 300);
  };

  return (
    <div className="animate-slide-up">
      {/* Risk level badge */}
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${risk.class}`}>
          <RiskIcon size={12} />
          {risk.label}
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1">
          <X size={16} />
        </button>
      </div>

      {/* Tool name */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="px-2 py-0.5 rounded text-xs font-mono-aether font-semibold"
            style={{ background: 'var(--aether-cyan-dim)', color: 'var(--aether-cyan)' }}
          >
            {approval.toolName}
          </div>
          <ChevronRight size={14} className="text-gray-600" />
          <span className="text-sm font-semibold text-gray-200">Requesting Access</span>
        </div>
      </div>

      {/* What it wants to do */}
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Action</p>
        <div
          className="p-3 rounded-lg font-mono-aether text-sm text-gray-200"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {approval.action}
        </div>
      </div>

      {/* Why Aether needs it */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Reasoning</p>
        <p className="text-sm text-gray-400 leading-relaxed">{approval.reason}</p>
      </div>

      {/* Risk description */}
      <div
        className="flex items-center gap-2 p-2.5 rounded-lg mb-5 text-xs"
        style={{
          background: `${risk.barColor}10`,
          border: `1px solid ${risk.barColor}25`,
          color: risk.barColor,
        }}
      >
        <RiskIcon size={12} />
        {risk.description}
      </div>

      {/* Deny reason input */}
      {showDenyInput && (
        <div className="mb-3 animate-slide-up">
          <p className="text-xs text-gray-500 mb-1.5">Reason for denial (optional)</p>
          <input
            type="text"
            value={denyReason}
            onChange={e => setDenyReason(e.target.value)}
            placeholder="e.g. Too risky, try another approach…"
            className="input-aether w-full px-3 py-2 text-sm"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleDeny()}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={isResolving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm btn-cyan disabled:opacity-50"
          aria-label="Approve this action"
        >
          <Check size={16} />
          Approve
        </button>
        <button
          onClick={handleDeny}
          disabled={isResolving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm btn-danger disabled:opacity-50"
          aria-label={showDenyInput ? 'Confirm denial' : 'Deny this action'}
        >
          <XCircle size={16} />
          {showDenyInput ? 'Confirm Deny' : 'Deny'}
        </button>
      </div>
    </div>
  );
}

export default function ApprovalModal({ approval, onClose }) {
  if (!approval) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-5 max-w-lg mx-auto animate-slide-up"
        style={{
          background: 'var(--aether-surface)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderBottom: 'none',
          boxShadow: '0 -20px 60px rgba(0, 212, 255, 0.08), 0 -4px 20px rgba(0,0,0,0.5)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Tool approval required"
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--aether-border)' }} />

        <h2 className="text-base font-bold text-gray-100 mb-1">Approval Required</h2>
        <p className="text-xs text-gray-500 mb-5">
          Aether is requesting permission to use a tool. Review and decide.
        </p>

        <ApprovalCard approval={approval} onClose={onClose} />
      </div>
    </>
  );
}