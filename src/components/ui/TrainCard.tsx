import React from 'react';
import { type Train } from '../../data/corridor';
import { ArrowRight, Gauge, Users } from 'lucide-react';

interface TrainCardProps {
  train: Train;
}

export const TrainCard: React.FC<TrainCardProps> = ({ train }) => {
  const isDelayed = train.predictedDelay > 0;
  const isSevere  = train.predictedDelay > 30;
  const occupancyRate = Math.round((train.passengerCount / train.capacity) * 100);

  const delayColor = isSevere
    ? 'var(--color-accent-red)'
    : isDelayed
    ? 'var(--color-accent-amber)'
    : 'var(--color-accent-green)';

  const delayBg = isSevere
    ? 'rgba(239,68,68,0.08)'
    : isDelayed
    ? 'rgba(245,158,11,0.08)'
    : 'rgba(34,197,94,0.08)';

  const delayBorder = isSevere
    ? 'rgba(239,68,68,0.25)'
    : isDelayed
    ? 'rgba(245,158,11,0.25)'
    : 'rgba(34,197,94,0.20)';

  const delayText = isDelayed ? `+${train.predictedDelay}m` : 'On Time';

  const barColor = occupancyRate > 90
    ? 'var(--color-accent-red)'
    : occupancyRate > 70
    ? 'var(--color-accent-amber)'
    : 'var(--color-accent-blue)';

  return (
    <div
      className="group bg-bg-card border border-border-default rounded-lg p-3 flex flex-col gap-2.5 transition-all duration-200 select-none hover:-translate-y-px"
      style={{ boxShadow: 'var(--shadow-card)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-elevated)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-hover)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-default)';
      }}
    >
      {/* ── Header Row ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[13px] font-semibold text-text-primary truncate leading-tight">
            {train.name}
          </span>
          <span className="font-mono text-[10px] text-text-tertiary tracking-wide">
            {train.id} · {train.type.toUpperCase()}
          </span>
        </div>

        {/* Delay badge */}
        <span
          className="text-[10px] font-mono font-bold shrink-0 px-2 py-0.5 rounded-md"
          style={{
            color: delayColor,
            background: delayBg,
            border: `1px solid ${delayBorder}`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {delayText}
        </span>
      </div>

      {/* ── Route Strip ── */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[10px] font-mono"
        style={{
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <span className="font-bold uppercase tracking-widest text-text-secondary">{train.currentStation}</span>
        <ArrowRight className="w-3 h-3 text-text-muted shrink-0" />
        <span className="font-bold uppercase tracking-widest text-text-secondary">{train.nextStation}</span>
        <span className="text-text-muted ml-auto text-[9px] normal-case tracking-normal">corridor</span>
      </div>

      {/* ── Stats Row ── */}
      <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary pt-1.5 border-t border-border-subtle">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-text-muted" />
          <span>
            Speed{' '}
            <strong className="text-text-primary font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {train.speed}
            </strong>
            {' '}km/h
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-text-muted" />
          <span>
            <strong
              className="font-bold"
              style={{ color: barColor, fontVariantNumeric: 'tabular-nums' }}
            >
              {occupancyRate}%
            </strong>
            {' '}full
          </span>
        </div>
      </div>

      {/* ── Occupancy Bar ── */}
      <div
        className="w-full h-[3px] rounded-full overflow-hidden"
        style={{ background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)' }}
      >
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{
            width: `${occupancyRate}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 6px ${barColor}`,
          }}
        />
      </div>
    </div>
  );
};
