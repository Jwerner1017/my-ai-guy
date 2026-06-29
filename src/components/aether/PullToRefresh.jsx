/**
 * PullToRefresh — Native-style pull-to-refresh indicator
 */
import React, { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 72;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const scrollRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const scrollEl = scrollRef.current;
    if (scrollEl && scrollEl.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      // Dampen the pull with rubber-band feel
      setPullDistance(Math.min(delta * 0.5, THRESHOLD * 1.2));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      await onRefresh?.();
      setRefreshing(false);
    }
    startY.current = null;
    setPullDistance(0);
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const isTriggered = pullDistance >= THRESHOLD;

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center items-center z-10 pointer-events-none transition-all duration-200"
        style={{
          top: -48,
          transform: `translateY(${pullDistance > 0 ? pullDistance : 0}px)`,
          opacity: progress,
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: isTriggered ? 'var(--aether-cyan-dim)' : 'var(--aether-surface)',
            border: `1px solid ${isTriggered ? 'rgba(0,212,255,0.4)' : 'var(--aether-border)'}`,
            boxShadow: isTriggered ? '0 0 12px rgba(0,212,255,0.2)' : 'none',
            transition: 'background 200ms, border-color 200ms, box-shadow 200ms',
          }}
        >
          <RefreshCw
            size={16}
            style={{
              color: isTriggered ? 'var(--aether-cyan)' : 'var(--aether-text-muted)',
              transform: `rotate(${progress * 180}deg)`,
              transition: 'color 200ms',
              animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
            }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none', transition: pullDistance === 0 ? 'transform 300ms ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}