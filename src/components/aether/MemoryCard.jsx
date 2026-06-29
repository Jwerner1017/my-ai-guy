/**
 * Memory Card — Individual memory item with importance bar, type badge, and expandable content
 */
import React, { useState } from 'react';
import { Brain, BookOpen, Lightbulb, Clock, Trash2, Edit3, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import wsClient from '@/lib/wsClient';

const TYPE_CONFIG = {
  episodic: {
    label: 'Episodic',
    icon: Clock,
    class: 'tag-cyan',
    color: '#00D4FF',
  },
  reflection: {
    label: 'Reflection',
    icon: Brain,
    class: 'tag-violet',
    color: '#9B5CFF',
  },
  lesson: {
    label: 'Lesson',
    icon: Lightbulb,
    class: 'tag-warning',
    color: '#FFB347',
  },
  general: {
    label: 'General',
    icon: BookOpen,
    class: 'tag-success',
    color: '#00E5A0',
  },
};

function ImportanceBar({ value, color, editable, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);

  const handleSave = () => {
    onEdit?.(tempVal);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono-aether text-gray-500 w-8 text-right">
        {(value * 100).toFixed(0)}%
      </span>
      {editable && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          aria-label="Edit importance"
        >
          <Edit3 size={11} />
        </button>
      )}
      {editing && (
        <div className="flex items-center gap-1">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={tempVal}
            onChange={e => setTempVal(parseFloat(e.target.value))}
            className="w-16 h-1 accent-cyan-400"
          />
          <button onClick={handleSave} className="text-emerald-400 hover:text-emerald-300">
            <Check size={11} />
          </button>
          <button onClick={() => setEditing(false)} className="text-red-400 hover:text-red-300">
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function MemoryCard({ memory, expanded: defaultExpanded = false, onDelete }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [deleted, setDeleted] = useState(false);
  const typeConfig = TYPE_CONFIG[memory.type] || TYPE_CONFIG.general;
  const TypeIcon = typeConfig.icon;

  if (deleted) return null;

  const handleDelete = () => {
    if (window.confirm('Delete this memory? This cannot be undone.')) {
      setDeleted(true);
      wsClient.deleteMemory(memory.id);
      onDelete?.(memory.id);
    }
  };

  const handleImportanceEdit = (newVal) => {
    wsClient.updateMemoryImportance(memory.id, newVal);
  };

  return (
    <div
      className={`card-aether overflow-hidden cursor-pointer transition-all duration-200 ${expanded ? 'card-aether-active' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Card header */}
      <div className="p-3">
        {/* Top row: type badge + timestamp + delete */}
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.class}`}>
            <TypeIcon size={10} />
            {typeConfig.label}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">
              {formatDistanceToNow(new Date(memory.timestamp), { addSuffix: true })}
            </span>
            {expanded && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
                aria-label="Delete memory"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Content snippet */}
        <p
          className="text-sm text-gray-300 leading-relaxed"
          style={{ 
            display: '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 2,
            WebkitBoxOrient: 'vertical',
            overflow: expanded ? 'visible' : 'hidden',
          }}
        >
          {memory.content}
        </p>

        {/* Tags */}
        {expanded && memory.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {memory.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--aether-text-muted)' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Importance bar */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Importance</span>
          {memory.relevance !== undefined && (
            <span className="text-xs text-gray-600">
              Relevance: <span className="text-gray-400">{(memory.relevance * 100).toFixed(0)}%</span>
            </span>
          )}
        </div>
        <ImportanceBar
          value={memory.importance}
          color={typeConfig.color}
          editable={expanded}
          onEdit={handleImportanceEdit}
        />
      </div>
    </div>
  );
}