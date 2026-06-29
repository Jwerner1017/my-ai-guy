/**
 * ThinkingNodeGraph — Animated pipeline visualization of Aether's thinking steps
 * Shows Planning → Memory → Execution → Reflection as live nodes with connecting beams
 */
import React, { useEffect, useRef, useState } from 'react';
import { Brain, Database, Cpu, Sparkles, CheckCircle, Loader2, Circle } from 'lucide-react';
import { NODE_STATUS } from '@/lib/aetherStore';
import { motion, AnimatePresence } from 'framer-motion';

const PIPELINE_STEPS = [
  { type: 'planner',   label: 'Plan',    icon: Brain,    color: '#9B5CFF', glow: 'rgba(155,92,255,0.4)' },
  { type: 'memory',    label: 'Memory',  icon: Database, color: '#00D4FF', glow: 'rgba(0,212,255,0.4)' },
  { type: 'executor',  label: 'Execute', icon: Cpu,      color: '#00E5A0', glow: 'rgba(0,229,160,0.4)' },
  { type: 'reflection',label: 'Reflect', icon: Sparkles, color: '#FFB347', glow: 'rgba(255,179,71,0.4)' },
];

// Match incoming nodes to pipeline steps
function buildPipelineState(nodes) {
  return PIPELINE_STEPS.map(step => {
    const match = [...nodes].reverse().find(n => n.type === step.type);
    return { ...step, node: match || null, status: match?.status || NODE_STATUS.IDLE };
  });
}

// Animated beam between two nodes
function Beam({ active, complete, color }) {
  return (
    <div className="flex-1 flex items-center justify-center px-1" style={{ minWidth: 20 }}>
      <div className="relative w-full h-px overflow-visible" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {/* Static line */}
        <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Completed fill */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ background: color, transformOrigin: 'left' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: complete ? 1 : 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* Active traveling particle */}
        {active && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}`, left: 0 }}
            animate={{ left: ['0%', '100%'] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
    </div>
  );
}

// Single node circle
function PipelineNode({ step, isActive, compact }) {
  const Icon = step.icon;
  const isDone = step.status === NODE_STATUS.COMPLETE;
  const isThinking = step.status === NODE_STATUS.THINKING || step.status === NODE_STATUS.WAITING;
  const isError = step.status === NODE_STATUS.ERROR;
  const isIdle = !isDone && !isThinking && !isError;

  const ringColor = isError ? '#FF4757' : isDone ? step.color : isThinking ? step.color : 'rgba(255,255,255,0.08)';
  const bgColor = isError ? 'rgba(255,71,87,0.12)' : isDone ? `${step.color}18` : isThinking ? `${step.color}12` : 'rgba(255,255,255,0.03)';
  const iconColor = isError ? '#FF4757' : isIdle ? '#374151' : step.color;

  return (
    <div className="flex flex-col items-center gap-2" style={{ minWidth: compact ? 52 : 60 }}>
      {/* Node circle */}
      <motion.div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: compact ? 44 : 52,
          height: compact ? 44 : 52,
          background: bgColor,
          border: `1.5px solid ${ringColor}`,
          transition: 'background 0.4s, border-color 0.4s',
        }}
        animate={isThinking ? { scale: [1, 1.07, 1], boxShadow: [`0 0 0px ${step.glow}`, `0 0 18px ${step.glow}`, `0 0 0px ${step.glow}`] } : {}}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Status overlay */}
        {isDone && (
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: step.color, zIndex: 2 }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <CheckCircle size={10} color="#0E0F12" strokeWidth={3} />
          </motion.div>
        )}
        {isThinking && (
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: step.color, zIndex: 2 }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <Loader2 size={10} color="#0E0F12" strokeWidth={3} className="animate-spin" />
          </motion.div>
        )}

        <Icon size={compact ? 18 : 20} color={iconColor} />
      </motion.div>

      {/* Label */}
      <span
        className="text-xs font-semibold text-center leading-tight"
        style={{ color: isIdle ? '#374151' : isDone || isThinking ? step.color : '#374151', fontSize: 10 }}
      >
        {step.label}
      </span>

      {/* Micro detail: node content teaser */}
      <AnimatePresence>
        {isThinking && step.node?.content && (
          <motion.p
            className="text-center font-mono-aether"
            style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, maxWidth: 56, lineHeight: 1.3 }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {step.node.content.slice(0, 28)}…
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ThinkingNodeGraph({ nodes = [], isExecuting = false }) {
  const pipeline = buildPipelineState(nodes);
  const containerRef = useRef(null);
  const [compact, setCompact] = useState(false);

  // Detect narrow screens
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setCompact(entry.contentRect.width < 340);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const hasActivity = nodes.length > 0 || isExecuting;
  const activeStepIndex = pipeline.findIndex(s => s.status === NODE_STATUS.THINKING || s.status === NODE_STATUS.WAITING);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--aether-surface)', border: '1px solid var(--aether-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Thinking Pipeline
          </span>
          {isExecuting && (
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#00E5A0' }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </div>
        {nodes.length > 0 && (
          <span className="font-mono-aether text-xs" style={{ color: 'var(--aether-text-muted)' }}>
            {pipeline.filter(s => s.status === NODE_STATUS.COMPLETE).length}/{PIPELINE_STEPS.length}
          </span>
        )}
      </div>

      {/* Pipeline row */}
      <div className="px-3 pb-4">
        {!hasActivity ? (
          /* Idle state — ghosted pipeline */
          <div className="flex items-start justify-between py-2">
            {PIPELINE_STEPS.map((step, i) => (
              <React.Fragment key={step.type}>
                <PipelineNode step={{ ...step, status: NODE_STATUS.IDLE, node: null }} compact={compact} />
                {i < PIPELINE_STEPS.length - 1 && (
                  <Beam active={false} complete={false} color={step.color} />
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="flex items-start justify-between py-2">
            {pipeline.map((step, i) => {
              const prevDone = i === 0 || pipeline[i - 1].status === NODE_STATUS.COMPLETE;
              const beamActive = prevDone && (step.status === NODE_STATUS.THINKING || step.status === NODE_STATUS.WAITING);
              const beamComplete = i > 0 && pipeline[i - 1].status === NODE_STATUS.COMPLETE;

              return (
                <React.Fragment key={step.type}>
                  {i > 0 && (
                    <Beam
                      active={beamActive}
                      complete={beamComplete}
                      color={pipeline[i - 1].color}
                    />
                  )}
                  <PipelineNode step={step} compact={compact} />
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Active step detail bar */}
        <AnimatePresence>
          {activeStepIndex >= 0 && pipeline[activeStepIndex].node && (
            <motion.div
              key={activeStepIndex}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 rounded-xl px-3 py-2.5"
                style={{
                  background: `${pipeline[activeStepIndex].color}08`,
                  border: `1px solid ${pipeline[activeStepIndex].color}20`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Loader2 size={10} className="animate-spin" style={{ color: pipeline[activeStepIndex].color }} />
                  <span className="text-xs font-semibold" style={{ color: pipeline[activeStepIndex].color }}>
                    {pipeline[activeStepIndex].label} in progress…
                  </span>
                </div>
                {pipeline[activeStepIndex].node?.content && (
                  <p className="font-mono-aether text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                    {pipeline[activeStepIndex].node.content.slice(0, 120)}
                    {pipeline[activeStepIndex].node.content.length > 120 ? '…' : ''}
                  </p>
                )}
                {/* Shimmer progress bar */}
                <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${pipeline[activeStepIndex].color}, transparent)`, width: '50%' }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}