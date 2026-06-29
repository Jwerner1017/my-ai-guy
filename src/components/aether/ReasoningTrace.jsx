/**
 * Reasoning Trace — Live execution node visualization
 * Shows Planner → Memory Retrieval → Executor → Reflection nodes lighting up
 */
import React, { useState } from 'react';
import { ChevronDown, Brain, Database, Cpu, Sparkles, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { NODE_STATUS } from '@/lib/aetherStore';
import { formatDistanceToNow } from 'date-fns';

const NODE_ICONS = {
  planner: Brain,
  memory: Database,
  executor: Cpu,
  reflection: Sparkles,
  generic: Cpu,
};

const NODE_LABELS = {
  planner: 'Planner',
  memory: 'Memory Retrieval',
  executor: 'Executor',
  reflection: 'Reflection',
  generic: 'Processing',
};

const STATUS_STYLES = {
  [NODE_STATUS.IDLE]: 'node-idle',
  [NODE_STATUS.THINKING]: 'node-thinking',
  [NODE_STATUS.COMPLETE]: 'node-complete',
  [NODE_STATUS.WAITING]: 'node-active',
  [NODE_STATUS.ERROR]: 'border-red-500/40',
};

function NodeCard({ node, index }) {
  const [expanded, setExpanded] = useState(node.status === NODE_STATUS.THINKING);
  const Icon = NODE_ICONS[node.type] || NODE_ICONS.generic;
  const statusClass = STATUS_STYLES[node.status] || STATUS_STYLES[NODE_STATUS.IDLE];

  const statusIcon = () => {
    switch (node.status) {
      case NODE_STATUS.THINKING:
        return <Loader2 size={13} className="text-amber-400 animate-spin" />;
      case NODE_STATUS.COMPLETE:
        return <CheckCircle size={13} className="text-emerald-400" />;
      case NODE_STATUS.ERROR:
        return <AlertCircle size={13} className="text-red-400" />;
      case NODE_STATUS.WAITING:
        return <Clock size={13} className="text-cyan-400 animate-pulse" />;
      default:
        return <div className="w-3 h-3 rounded-full border border-gray-600" />;
    }
  };

  const statusColor = () => {
    switch (node.status) {
      case NODE_STATUS.THINKING: return '#FFB347';
      case NODE_STATUS.COMPLETE: return '#00E5A0';
      case NODE_STATUS.ERROR: return '#FF4757';
      case NODE_STATUS.WAITING: return '#00D4FF';
      default: return '#4B5563';
    }
  };

  return (
    <div
      className={`card-aether transition-all duration-300 node-appear ${statusClass}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-3 text-left cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {/* Node type icon */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300"
          style={{ background: `${statusColor()}15`, border: `1px solid ${statusColor()}30` }}
        >
          <Icon size={14} style={{ color: statusColor() }} />
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-200 truncate">
              {NODE_LABELS[node.type] || node.name}
            </span>
            {statusIcon()}
          </div>
          {node.timestamp && (
            <span className="text-xs text-gray-600">
              {formatDistanceToNow(new Date(node.timestamp), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Expand chevron */}
        {(node.content || node.result) && (
          <ChevronDown
            size={14}
            className={`text-gray-500 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (node.content || node.result || node.error) && (
        <div className="px-3 pb-3">
          <div
            className="rounded-lg p-3 font-mono-aether text-xs leading-relaxed"
            style={{
              background: 'rgba(0,0,0,0.3)',
              color: node.status === NODE_STATUS.ERROR ? '#FF4757' : '#9CA3AF',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {node.error || node.result || node.content}
          </div>
        </div>
      )}

      {/* Thinking animation bar */}
      {node.status === NODE_STATUS.THINKING && (
        <div className="px-3 pb-3">
          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,179,71,0.1)' }}>
            <div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #FFB347, transparent)',
                animation: 'shimmer 1.5s linear infinite',
                width: '60%',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Connector line between nodes
function NodeConnector({ active }) {
  return (
    <div className="flex justify-start pl-5 my-1">
      <div
        className="w-px h-4 transition-colors duration-500"
        style={{ background: active ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)' }}
      />
    </div>
  );
}

export default function ReasoningTrace({ nodes = [], collapsed = false, onToggle }) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
          style={{ background: 'var(--aether-cyan-dim)' }}
        >
          <Brain size={22} style={{ color: 'var(--aether-cyan)' }} />
        </div>
        <p className="text-sm font-medium text-gray-400">Reasoning trace will appear here</p>
        <p className="text-xs text-gray-600 mt-1">Submit a goal to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between mb-3 group"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Reasoning Trace
            </span>
            <div
              className="px-1.5 py-0.5 rounded text-xs font-mono"
              style={{ background: 'var(--aether-cyan-dim)', color: 'var(--aether-cyan)' }}
            >
              {nodes.length}
            </div>
          </div>
          <ChevronDown
            size={14}
            className={`text-gray-600 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>
      )}

      {/* Nodes */}
      {!collapsed && (
        <div>
          {nodes.map((node, index) => (
            <React.Fragment key={node.id}>
              <NodeCard node={node} index={index} />
              {index < nodes.length - 1 && (
                <NodeConnector active={node.status === NODE_STATUS.COMPLETE} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}