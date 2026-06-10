import React, { useState, useEffect } from 'react';

export interface RiskBadgeProps {
  level: 'low' | 'moderate' | 'high' | 'critical';
}

const RISK_STYLES = {
  low: {
    bg:     'var(--color-risk-low-bg)',
    text:   'var(--color-risk-low)',
    border: 'var(--color-risk-low-border)',
    glow:   'rgba(34, 197, 94, 0.25)',
    dot:    'var(--color-risk-low)',
  },
  moderate: {
    bg:     'var(--color-risk-moderate-bg)',
    text:   'var(--color-risk-moderate)',
    border: 'var(--color-risk-moderate-border)',
    glow:   'rgba(245, 158, 11, 0.25)',
    dot:    'var(--color-risk-moderate)',
  },
  high: {
    bg:     'var(--color-risk-high-bg)',
    text:   'var(--color-risk-high)',
    border: 'var(--color-risk-high-border)',
    glow:   'rgba(249, 115, 22, 0.25)',
    dot:    'var(--color-risk-high)',
  },
  critical: {
    bg:     'var(--color-risk-critical-bg)',
    text:   'var(--color-risk-critical)',
    border: 'var(--color-risk-critical-border)',
    glow:   'rgba(239, 68, 68, 0.35)',
    dot:    'var(--color-risk-critical)',
  },
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level }) => {
  const [pop, setPop] = useState(false);

  useEffect(() => {
    setPop(true);
    const timer = setTimeout(() => setPop(false), 320);
    return () => clearTimeout(timer);
  }, [level]);

  const s = RISK_STYLES[level] ?? RISK_STYLES.low;
  const isCritical = level === 'critical';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border uppercase select-none transition-transform duration-200 ${
        isCritical ? 'animate-critical-border' : ''
      } ${pop ? 'animate-badge-pop' : ''}`}
      style={{
        backgroundColor: s.bg,
        color:           s.text,
        borderColor:     s.border,
        letterSpacing:   '0.08em',
        boxShadow:       `0 0 8px ${s.glow}`,
      }}
    >
      {/* Status dot */}
      <span
        className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
        style={{
          backgroundColor: s.dot,
          boxShadow: `0 0 5px ${s.glow}`,
        }}
      />
      {level}
    </span>
  );
};
