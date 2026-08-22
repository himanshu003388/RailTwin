import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  trend,
  color = 'var(--color-text-primary)',
}) => {
  // Derive a soft glow from the color
  const isVar = color.startsWith('var(');
  const glowColor = isVar
    ? undefined
    : `${color}33`; // 20% alpha version of the hex color

  return (
    <div
      className="group bg-bg-card border border-border-default rounded-lg p-2.5 sm:p-3.5 flex flex-col justify-between select-none transition-all duration-200 hover:-translate-y-px cursor-default"
      style={{
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-elevated)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-hover)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-default)';
      }}
    >
      {/* Label */}
      <span className="text-[10px] text-text-tertiary uppercase tracking-[0.1em] font-mono font-medium">
        {label}
      </span>

      {/* Value Row */}
      <div className="flex items-baseline gap-1 mt-2">
        <span
          className="text-xl font-mono font-bold tracking-tight"
          style={{
            color,
            fontVariantNumeric: 'tabular-nums',
            textShadow: glowColor ? `0 0 16px ${glowColor}` : undefined,
          }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[11px] text-text-tertiary font-mono ml-0.5 font-normal">
            {unit}
          </span>
        )}
      </div>

      {/* Trend indicator */}
      {trend && (
        <div className="mt-1.5 flex items-center text-[10px] font-mono">
          {trend === 'up'      && <span className="text-accent-green flex items-center gap-1">▲ <span className="text-text-tertiary">+3% vs pre-alert</span></span>}
          {trend === 'down'    && <span className="text-accent-red   flex items-center gap-1">▼ <span className="text-text-tertiary">-12% optimized</span></span>}
          {trend === 'neutral' && <span className="text-text-muted   flex items-center gap-1">■ <span>stable</span></span>}
        </div>
      )}
    </div>
  );
};
