import React, { useState, useEffect } from 'react';

export interface RiskBadgeProps {
  level: 'low' | 'moderate' | 'high' | 'critical';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level }) => {
  const [pop, setPop] = useState(false);

  useEffect(() => {
    setPop(true);
    const timer = setTimeout(() => setPop(false), 300);
    return () => clearTimeout(timer);
  }, [level]);

  // Define styles map
  const styles = {
    low: {
      bg: '#052e16',
      text: '#22c55e',
      border: '#166534',
      dot: '#22c55e'
    },
    moderate: {
      bg: '#451a03',
      text: '#f59e0b',
      border: '#92400e',
      dot: '#f59e0b'
    },
    high: {
      bg: '#431407',
      text: '#f97316',
      border: '#9a3412',
      dot: '#f97316'
    },
    critical: {
      bg: '#450a0a',
      text: '#ef4444',
      border: '#991b1b',
      dot: '#ef4444'
    }
  };

  const current = styles[level] || styles.low;
  const isCritical = level === 'critical';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium border uppercase tracking-wider select-none transition-transform duration-300 ${
        isCritical ? 'animate-critical-border' : ''
      } ${pop ? 'animate-badge-pop' : ''}`}
      style={{
        backgroundColor: current.bg,
        color: current.text,
        borderColor: current.border
      }}
    >
      {/* Dot indicator */}
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ backgroundColor: current.dot }}
      />
      <span>{level}</span>
    </span>
  );
};
