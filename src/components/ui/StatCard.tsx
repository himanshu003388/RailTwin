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
  color = '#ffffff'
}) => {
  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-3.5 flex flex-col justify-between select-none hover:border-border-hover transition-colors duration-150">
      {/* Label */}
      <span className="text-[10px] text-text-secondary uppercase tracking-wider font-mono font-semibold">
        {label}
      </span>

      {/* Value Row */}
      <div className="flex items-baseline gap-1 mt-1">
        <span
          className="text-xl font-mono font-bold tracking-tight"
          style={{ color }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-text-secondary font-mono ml-0.5">
            {unit}
          </span>
        )}
      </div>

      {/* Optional Trend indicator */}
      {trend && (
        <div className="mt-1 flex items-center text-[10px] font-mono">
          {trend === 'up' && <span className="text-[#22c55e]">▲ +3% vs pre-alert</span>}
          {trend === 'down' && <span className="text-[#ef4444]">▼ -12% optimized</span>}
          {trend === 'neutral' && <span className="text-text-tertiary">■ stable</span>}
        </div>
      )}
    </div>
  );
};
