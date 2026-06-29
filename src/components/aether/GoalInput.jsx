/**
 * Goal Input — The primary "Give Aether a Goal" field
 * Prominent, beautiful, with history dropdown and submit animation
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, History, Sparkles, Loader2 } from 'lucide-react';
import useAetherStore, { CONNECTION_STATUS } from '@/lib/aetherStore';
import wsClient from '@/lib/wsClient';

const GOAL_SUGGESTIONS = [
  'Research and summarize recent advances in…',
  'Help me plan and organize…',
  'Reflect on our recent sessions and extract…',
  'Write a comprehensive guide on…',
  'Analyze and improve my…',
];

export default function GoalInput({ onGoalSubmit }) {
  const [text, setText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const { connectionStatus, recentGoals, isExecuting } = useAetherStore();

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const canSubmit = isConnected && !isExecuting && text.trim().length > 0;

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const goalText = text.trim();
    setIsSubmitting(true);
    setText('');
    setShowHistory(false);

    try {
      const goal = wsClient.submitGoal(goalText);
      onGoalSubmit?.(goal);
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') setShowHistory(false);
  };

  return (
    <div className="relative">
      {/* Main input container */}
      <div
        className="relative rounded-xl transition-all duration-300"
        style={{
          background: 'var(--aether-surface-2)',
          border: `1px solid ${text.length > 0 ? 'rgba(0, 212, 255, 0.3)' : 'var(--aether-border)'}`,
          boxShadow: text.length > 0 ? '0 0 0 3px rgba(0, 212, 255, 0.06), 0 4px 20px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        {/* Sparkle icon */}
        <div className="absolute left-3.5 top-3.5 pointer-events-none">
          <Sparkles
            size={16}
            style={{ color: text.length > 0 ? 'var(--aether-cyan)' : 'var(--aether-text-dim)' }}
            className="transition-colors duration-300"
          />
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 150)}
          placeholder={
            !isConnected
              ? 'Connect to Aether to submit goals…'
              : isExecuting
                ? 'Aether is executing — interrupt or wait…'
                : 'Give Aether a goal… (⌘↵ to submit)'
          }
          disabled={!isConnected || isExecuting}
          rows={1}
          className="w-full resize-none bg-transparent pl-10 pr-12 pt-3.5 pb-3.5 text-sm text-gray-100 leading-relaxed focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontFamily: 'Inter, sans-serif', maxHeight: '120px' }}
          aria-label="Give Aether a goal"
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="absolute right-3 bottom-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-30"
          style={{
            background: canSubmit ? 'var(--aether-cyan)' : 'rgba(255,255,255,0.06)',
          }}
          aria-label="Submit goal"
        >
          {isSubmitting
            ? <Loader2 size={13} className="text-gray-900 animate-spin" />
            : <Send size={13} style={{ color: canSubmit ? '#0E0F12' : '#6B7280' }} />
          }
        </button>
      </div>

      {/* Recent goals dropdown */}
      {showHistory && recentGoals.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-20 animate-slide-up"
          style={{
            background: 'var(--aether-surface)',
            border: '1px solid var(--aether-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--aether-border)' }}>
            <History size={12} className="text-gray-600" />
            <span className="text-xs text-gray-500 font-medium">Recent Goals</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {recentGoals.slice(0, 8).map(goal => (
              <button
                key={goal.id}
                className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors group"
                onMouseDown={() => { setText(goal.text); setShowHistory(false); }}
              >
                <p className="text-sm text-gray-300 truncate group-hover:text-gray-100 transition-colors">
                  {goal.text}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {goal.status === 'complete' ? '✓ Completed' : goal.status}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hint */}
      {text.length > 0 && (
        <p className="text-xs text-gray-600 mt-1.5 ml-1">
          ⌘↵ to submit
        </p>
      )}
    </div>
  );
}