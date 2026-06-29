/**
 * Memory Browser — Search, filter, and manage Aether's memory
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Sparkles, RefreshCw, X, Loader2 } from 'lucide-react';
import StatusBar from '@/components/aether/StatusBar';
import MemoryCard from '@/components/aether/MemoryCard';
import PullToRefresh from '@/components/aether/PullToRefresh';
import useAetherStore from '@/lib/aetherStore';
import wsClient from '@/lib/wsClient';

const FILTER_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'episodic', label: 'Episodic' },
  { id: 'reflection', label: 'Reflections' },
  { id: 'lesson', label: 'Lessons' },
];

// ── Reflection Trigger ────────────────────────────────────────────────────────
function ReflectionBanner({ onTrigger }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleTrigger = async () => {
    setLoading(true);
    wsClient.triggerReflection();
    await new Promise(r => setTimeout(r, 2000));
    setLoading(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
    onTrigger?.();
  };

  return (
    <button
      onClick={handleTrigger}
      disabled={loading}
      className="w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200"
      style={{
        background: 'var(--aether-violet-dim)',
        border: '1px solid rgba(108, 62, 255, 0.25)',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(108,62,255,0.15)' }}
      >
        {loading
          ? <Loader2 size={17} className="text-purple-400 animate-spin" />
          : <Sparkles size={17} className="text-purple-400" />
        }
      </div>
      <div className="text-left flex-1">
        <p className="text-sm font-semibold text-purple-300">
          {done ? '✓ Reflection Complete' : loading ? 'Running reflection…' : 'Trigger Reflection'}
        </p>
        <p className="text-xs text-purple-500/80 mt-0.5">
          Aether will analyze recent sessions and extract new lessons
        </p>
      </div>
    </button>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyMemory({ filter, query }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--aether-cyan-dim)', border: '1px solid rgba(0,212,255,0.15)' }}
      >
        <Search size={24} style={{ color: 'var(--aether-cyan)' }} />
      </div>
      <h3 className="font-semibold text-gray-300 mb-2">
        {query ? `No results for "${query}"` : filter !== 'all' ? `No ${filter} memories yet` : 'No memories yet'}
      </h3>
      <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
        {query
          ? 'Try different keywords or clear the search filter.'
          : 'Give Aether goals to work on — memories accumulate through sessions and reflections.'}
      </p>
    </div>
  );
}

// ── Main Memory Browser ───────────────────────────────────────────────────────
export default function MemoryBrowser() {
  const { memories, memoriesLoading, memoryCount } = useAetherStore();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Fetch memories on mount
  useEffect(() => {
    wsClient.fetchMemories({});
  }, []);

  // Filter + search
  const filtered = useMemo(() => {
    let result = memories;
    if (activeFilter !== 'all') {
      result = result.filter(m => m.type === activeFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(m =>
        m.content.toLowerCase().includes(q) ||
        m.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    // Sort by importance desc
    return [...result].sort((a, b) => (b.importance || 0) - (a.importance || 0));
  }, [memories, activeFilter, query]);

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--aether-bg)' }}>
      <StatusBar />

      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--aether-text)', letterSpacing: '-0.02em' }}
            >
              Memory
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--aether-text-muted)' }}>
              {memoryCount > 0 ? `${memoryCount} stored` : 'Building knowledge base…'}
            </p>
          </div>

          {/* Refresh */}
          <button
            onClick={() => wsClient.fetchMemories({})}
            className="w-9 h-9 rounded-xl flex items-center justify-center btn-surface"
            aria-label="Refresh memories"
          >
            <RefreshCw size={15} style={{ color: 'var(--aether-text-muted)' }} />
          </button>
        </div>

        {/* Search */}
        <div
          className="relative mb-3"
        >
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search memories…"
            className="input-aether w-full pl-9 pr-9 py-2.5 text-sm"
            aria-label="Search memories"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTER_TYPES.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
              style={{
                background: activeFilter === f.id ? 'var(--aether-cyan-dim)' : 'var(--aether-surface)',
                color: activeFilter === f.id ? 'var(--aether-cyan)' : 'var(--aether-text-muted)',
                border: `1px solid ${activeFilter === f.id ? 'rgba(0,212,255,0.3)' : 'var(--aether-border)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable list with pull-to-refresh */}
      <PullToRefresh onRefresh={() => wsClient.fetchMemories({})}>
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="space-y-3 max-w-2xl mx-auto">

          {/* Reflection trigger */}
          <ReflectionBanner />

          {/* Loading skeletons */}
          {memoriesLoading && (
            <>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-24 rounded-xl animate-shimmer relative overflow-hidden"
                  style={{ background: 'var(--aether-surface)' }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
                    }}
                  />
                </div>
              ))}
            </>
          )}

          {/* Memory cards */}
          {!memoriesLoading && filtered.length === 0 && (
            <EmptyMemory filter={activeFilter} query={query} />
          )}

          {!memoriesLoading && filtered.map(memory => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>
      </div>
      </PullToRefresh>
    </div>
  );
}