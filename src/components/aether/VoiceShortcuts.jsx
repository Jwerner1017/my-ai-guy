/**
 * VoiceShortcuts — Create, edit, delete, and reorder voice-triggered shortcuts
 * Each shortcut has a trigger phrase and an action (submit a goal or run a workflow)
 */
import React, { useState } from 'react';
import { Plus, Mic, Trash2, Edit2, Zap, X, Check, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAetherStore from '@/lib/aetherStore';

const ACTION_TYPES = [
  { id: 'goal',       label: 'Submit Goal',       hint: 'Send a goal to Aether for execution',   color: '#00D4FF' },
  { id: 'reflect',    label: 'Trigger Reflection', hint: 'Run a memory reflection cycle',         color: '#9B5CFF' },
  { id: 'memory',     label: 'Fetch Memories',     hint: 'Browse recent memory entries',          color: '#00E5A0' },
  { id: 'interrupt',  label: 'Interrupt Goal',     hint: 'Stop the currently running goal',       color: '#FF4757' },
];

function ShortcutForm({ initial, onSave, onCancel }) {
  const [phrase, setPhrase] = useState(initial?.phrase || '');
  const [actionType, setActionType] = useState(initial?.actionType || 'goal');
  const [payload, setPayload] = useState(initial?.payload || '');

  const needsPayload = actionType === 'goal';

  const valid = phrase.trim().length > 1 && (!needsPayload || payload.trim().length > 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-2xl p-4 space-y-4"
      style={{ background: 'var(--aether-surface-2)', border: '1px solid var(--aether-border-active)' }}
    >
      {/* Trigger phrase */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--aether-text-muted)' }}>
          Trigger Phrase
        </label>
        <div className="relative">
          <Mic size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            placeholder='e.g. "start research"'
            className="input-aether w-full pl-8 pr-3 py-2.5 text-sm"
            autoFocus
          />
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--aether-text-dim)' }}>Speak this phrase to trigger the action</p>
      </div>

      {/* Action type */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--aether-text-muted)' }}>
          Action
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ACTION_TYPES.map(a => (
            <button
              key={a.id}
              onClick={() => setActionType(a.id)}
              className="flex flex-col items-start p-2.5 rounded-xl text-left transition-all"
              style={{
                background: actionType === a.id ? `${a.color}12` : 'var(--aether-surface)',
                border: `1px solid ${actionType === a.id ? `${a.color}40` : 'var(--aether-border)'}`,
              }}
            >
              <span className="text-xs font-semibold" style={{ color: actionType === a.id ? a.color : 'var(--aether-text-muted)' }}>
                {a.label}
              </span>
              <span className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--aether-text-dim)', fontSize: 10 }}>
                {a.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Payload (goal text) */}
      <AnimatePresence>
        {needsPayload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--aether-text-muted)' }}>
              Goal Text
            </label>
            <textarea
              value={payload}
              onChange={e => setPayload(e.target.value)}
              placeholder="The goal text to submit when triggered…"
              rows={2}
              className="input-aether w-full px-3 py-2 text-sm resize-none"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium btn-surface"
        >
          <X size={14} /> Cancel
        </button>
        <button
          onClick={() => valid && onSave({ phrase: phrase.trim(), actionType, payload: payload.trim() })}
          disabled={!valid}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold btn-cyan disabled:opacity-40"
        >
          <Check size={14} /> Save
        </button>
      </div>
    </motion.div>
  );
}

function ShortcutRow({ shortcut, onEdit, onDelete, matched }) {
  const actionConfig = ACTION_TYPES.find(a => a.id === shortcut.actionType) || ACTION_TYPES[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0, boxShadow: matched ? `0 0 0 1px ${actionConfig.color}50, 0 0 12px ${actionConfig.color}20` : 'none' }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'var(--aether-surface)', border: `1px solid ${matched ? `${actionConfig.color}40` : 'var(--aether-border)'}`, transition: 'border-color 0.3s, box-shadow 0.3s' }}
    >
      {/* Phrase + action */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Mic size={11} style={{ color: actionConfig.color, flexShrink: 0 }} />
          <span className="text-sm font-semibold text-gray-200 truncate">"{shortcut.phrase}"</span>
          {matched && (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="flex-shrink-0 w-2 h-2 rounded-full"
              style={{ background: actionConfig.color }}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <ChevronRight size={10} style={{ color: actionConfig.color }} />
          <span className="text-xs font-medium" style={{ color: actionConfig.color }}>{actionConfig.label}</span>
          {shortcut.payload && (
            <span className="text-xs truncate" style={{ color: 'var(--aether-text-dim)', maxWidth: 120 }}>
              : {shortcut.payload}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
          aria-label="Edit shortcut"
        >
          <Edit2 size={13} style={{ color: 'var(--aether-text-muted)' }} />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
          aria-label="Delete shortcut"
        >
          <Trash2 size={13} style={{ color: '#FF4757' }} />
        </button>
      </div>
    </motion.div>
  );
}

export default function VoiceShortcuts({ matchedPhraseId, onClose }) {
  const { voiceShortcuts, addVoiceShortcut, updateVoiceShortcut, deleteVoiceShortcut } = useAetherStore();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleSaveNew = (data) => {
    addVoiceShortcut(data);
    setAdding(false);
  };

  const handleSaveEdit = (id, data) => {
    updateVoiceShortcut(id, data);
    setEditingId(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl max-w-lg mx-auto flex flex-col animate-slide-up"
        style={{
          background: 'var(--aether-surface)',
          border: '1px solid var(--aether-border)',
          borderBottom: 'none',
          maxHeight: '85vh',
        }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 flex-shrink-0" style={{ background: 'var(--aether-border)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-100 flex items-center gap-2">
              <Zap size={16} style={{ color: 'var(--aether-cyan)' }} />
              Voice Shortcuts
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--aether-text-muted)' }}>
              Speak a phrase to instantly trigger tasks
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          <AnimatePresence mode="popLayout">
            {voiceShortcuts.map(sc => (
              editingId === sc.id
                ? (
                  <ShortcutForm
                    key={`edit-${sc.id}`}
                    initial={sc}
                    onSave={(data) => handleSaveEdit(sc.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <ShortcutRow
                    key={sc.id}
                    shortcut={sc}
                    matched={matchedPhraseId === sc.id}
                    onEdit={() => setEditingId(sc.id)}
                    onDelete={() => deleteVoiceShortcut(sc.id)}
                  />
                )
            ))}

            {/* Add form */}
            {adding && (
              <ShortcutForm
                key="new"
                onSave={handleSaveNew}
                onCancel={() => setAdding(false)}
              />
            )}
          </AnimatePresence>

          {/* Empty state */}
          {voiceShortcuts.length === 0 && !adding && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--aether-cyan-dim)' }}
              >
                <Mic size={22} style={{ color: 'var(--aether-cyan)' }} />
              </div>
              <p className="text-sm font-medium text-gray-400">No shortcuts yet</p>
              <p className="text-xs text-gray-600 mt-1">Add a phrase to trigger tasks hands-free</p>
            </div>
          )}
        </div>

        {/* Add button */}
        {!adding && editingId === null && (
          <div className="px-5 pb-6 pt-2 flex-shrink-0" style={{ borderTop: '1px solid var(--aether-border)' }}>
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm btn-cyan"
            >
              <Plus size={16} /> Add Shortcut
            </button>
          </div>
        )}
      </div>
    </>
  );
}