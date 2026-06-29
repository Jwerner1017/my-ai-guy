/**
 * Aether Voice Orb — the emotional centerpiece of Voice Mode
 * Animated orb that changes state: idle → listening → thinking → speaking
 */
import React, { useEffect, useRef, useState } from 'react';
import { VOICE_STATE } from '@/lib/aetherStore';

const ORB_CONFIG = {
  [VOICE_STATE.IDLE]: {
    primaryColor: '#00D4FF',
    secondaryColor: '#6C3EFF',
    glowColor: 'rgba(0, 212, 255, 0.3)',
    pulseGlow: 'rgba(108, 62, 255, 0.15)',
    orbClass: 'orb-idle',
    ringOpacity: 0.15,
    label: 'Tap to speak',
    sublabel: 'Aether is ready',
  },
  [VOICE_STATE.LISTENING]: {
    primaryColor: '#00D4FF',
    secondaryColor: '#00B4E0',
    glowColor: 'rgba(0, 212, 255, 0.5)',
    pulseGlow: 'rgba(0, 212, 255, 0.2)',
    orbClass: 'orb-listening',
    ringOpacity: 0.3,
    label: 'Listening…',
    sublabel: 'Speak now',
  },
  [VOICE_STATE.THINKING]: {
    primaryColor: '#9B5CFF',
    secondaryColor: '#6C3EFF',
    glowColor: 'rgba(108, 62, 255, 0.5)',
    pulseGlow: 'rgba(155, 92, 255, 0.2)',
    orbClass: 'orb-thinking',
    ringOpacity: 0.4,
    label: 'Thinking…',
    sublabel: 'Processing your request',
  },
  [VOICE_STATE.SPEAKING]: {
    primaryColor: '#00E5A0',
    secondaryColor: '#00C090',
    glowColor: 'rgba(0, 229, 160, 0.4)',
    pulseGlow: 'rgba(0, 229, 160, 0.15)',
    orbClass: 'orb-speaking',
    ringOpacity: 0.35,
    label: 'Speaking',
    sublabel: 'Tap to interrupt',
  },
};

// Animated waveform bars (shown during listening/speaking)
function WaveformBars({ active, color }) {
  if (!active) return null;
  return (
    <div className="flex items-end justify-center gap-1" style={{ height: '32px' }}>
      {[...Array(9)].map((_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            background: color,
            height: '100%',
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

export default function AetherOrb({
  voiceState = VOICE_STATE.IDLE,
  onClick,
  size = 200,
  showLabel = true,
  showWaveform = true,
}) {
  const config = ORB_CONFIG[voiceState] || ORB_CONFIG[VOICE_STATE.IDLE];
  const isActive = voiceState !== VOICE_STATE.IDLE;
  const showWave = showWaveform && (voiceState === VOICE_STATE.LISTENING || voiceState === VOICE_STATE.SPEAKING);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Outer ring glow layers */}
      <div className="relative flex items-center justify-center" style={{ width: size + 80, height: size + 80 }}>
        
        {/* Outermost diffuse glow */}
        <div
          className="absolute rounded-full transition-all duration-700"
          style={{
            width: size + 80,
            height: size + 80,
            background: `radial-gradient(circle, ${config.pulseGlow} 0%, transparent 70%)`,
            opacity: isActive ? 1 : 0.5,
          }}
        />

        {/* Middle ring */}
        <div
          className="absolute rounded-full transition-all duration-500"
          style={{
            width: size + 40,
            height: size + 40,
            border: `1px solid ${config.primaryColor}`,
            opacity: config.ringOpacity,
          }}
        />

        {/* Inner ring */}
        <div
          className="absolute rounded-full transition-all duration-500"
          style={{
            width: size + 16,
            height: size + 16,
            border: `1px solid ${config.primaryColor}`,
            opacity: config.ringOpacity * 1.5,
          }}
        />

        {/* Main orb */}
        <button
          onClick={onClick}
          aria-label={config.label}
          className={`relative rounded-full cursor-pointer transition-all duration-500 ${config.orbClass} focus:outline-none`}
          style={{
            width: size,
            height: size,
            background: `radial-gradient(circle at 35% 35%, 
              ${config.primaryColor}40, 
              ${config.secondaryColor}80 45%, 
              ${config.secondaryColor}CC 100%
            )`,
            boxShadow: `
              0 0 ${size * 0.2}px ${config.glowColor},
              0 0 ${size * 0.5}px ${config.pulseGlow},
              inset 0 1px 0 rgba(255,255,255,0.1),
              inset 0 -1px 0 rgba(0,0,0,0.2)
            `,
            border: `1px solid ${config.primaryColor}40`,
          }}
        >
          {/* Inner light reflection */}
          <div
            className="absolute rounded-full"
            style={{
              top: '15%',
              left: '20%',
              width: '30%',
              height: '25%',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.15) 0%, transparent 100%)',
              transform: 'rotate(-30deg)',
            }}
          />

          {/* State icon inside orb */}
          <div className="absolute inset-0 flex items-center justify-center">
            {voiceState === VOICE_STATE.THINKING && (
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: config.primaryColor,
                      animation: `orbPulse 1s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}
            {voiceState === VOICE_STATE.LISTENING && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex gap-1 items-end" style={{ height: 20 }}>
                  {[3, 7, 10, 7, 3].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full"
                      style={{
                        height: h,
                        background: config.primaryColor,
                        animation: `waveBar 0.9s ease-in-out ${i * 0.1}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Waveform below orb */}
      {showWave && (
        <WaveformBars active={showWave} color={config.primaryColor} />
      )}

      {/* Label */}
      {showLabel && (
        <div className="text-center">
          <p className="font-semibold text-base" style={{ color: config.primaryColor }}>
            {config.label}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--aether-text-muted)' }}>
            {config.sublabel}
          </p>
        </div>
      )}
    </div>
  );
}