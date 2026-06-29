/**
 * Particle Field — Animated background particles for splash/onboarding screens
 * Pure CSS/SVG, no canvas dependency
 */
import React, { useMemo } from 'react';

function Particle({ x, y, size, duration, delay, color, dx, dy }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: color,
        opacity: 0.4,
        animation: `particleDrift ${duration}s ease-in-out ${delay}s infinite`,
        '--dx': `${dx}px`,
        '--dy': `${dy}px`,
        filter: 'blur(0.5px)',
      }}
    />
  );
}

export default function ParticleField({ count = 30, className = '' }) {
  const particles = useMemo(() => {
    const colors = [
      'rgba(0, 212, 255, 0.6)',
      'rgba(108, 62, 255, 0.5)',
      'rgba(155, 92, 255, 0.4)',
      'rgba(0, 212, 255, 0.3)',
      'rgba(255, 255, 255, 0.2)',
    ];

    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      dx: (Math.random() - 0.5) * 40,
      dy: (Math.random() - 0.5) * 40,
    }));
  }, [count]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map(p => <Particle key={p.id} {...p} />)}

      {/* Large diffuse orbs */}
      <div
        className="absolute -top-20 -left-20 w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
          animation: 'float 10s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(108,62,255,0.08) 0%, transparent 70%)',
          animation: 'float 14s ease-in-out 2s infinite',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0,212,255,0.03) 0%, transparent 70%)',
          animation: 'breathe 8s ease-in-out 1s infinite',
        }}
      />
    </div>
  );
}