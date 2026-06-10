import React from 'react';
import { type Train } from '../../data/corridor';
import { ShieldCheck, ShieldAlert, ArrowRight, Gauge, Users } from 'lucide-react';

interface TrainCardProps {
  train: Train;
}

export const TrainCard: React.FC<TrainCardProps> = ({ train }) => {
  const isDelayed = train.predictedDelay > 0;
  const isSevere = train.predictedDelay > 30;

  // Formatting delays
  const delayColor = isSevere
    ? 'text-[#ef4444]'
    : isDelayed
    ? 'text-[#f59e0b]'
    : 'text-[#22c55e]';

  const delayText = isDelayed
    ? `Delayed +${train.predictedDelay}m`
    : 'On Schedule';

  // Occupancy percentage
  const occupancyRate = Math.round((train.passengerCount / train.capacity) * 100);

  return (
    <div className="bg-bg-card border border-border-default hover:border-border-hover rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-150 select-none">
      {/* Top Header Row */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-white truncate max-w-[170px] leading-tight">
            {train.name}
          </span>
          <span className="font-mono text-[10px] text-text-tertiary">
            ID: {train.id} • {train.type.toUpperCase()}
          </span>
        </div>

        {/* Status indicator */}
        <span className={`text-[10px] font-mono font-bold uppercase ${delayColor}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {delayText}
        </span>
      </div>

      {/* Route Info */}
      <div className="flex items-center gap-2 bg-[#1a1a1a] px-2 py-1 rounded-md border border-[#222222]/50 text-[10px] font-mono text-text-secondary">
        <span className="font-mono font-bold uppercase tracking-widest text-[#555]">{train.currentStation}</span>
        <ArrowRight className="w-3 h-3 text-text-tertiary" />
        <span className="font-mono font-bold uppercase tracking-widest text-[#555]">{train.nextStation}</span>
        <span className="text-text-tertiary ml-auto">corridor route</span>
      </div>

      {/* Speed & Occupancy Stats */}
      <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary pt-1 border-t border-border-default/30">
        <div className="flex items-center gap-1">
          <Gauge className="w-3.5 h-3.5 text-text-tertiary" />
          <span>Speed: <strong className="text-white font-bold">{train.speed}</strong> km/h</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-text-tertiary" />
          <div className="flex flex-col gap-0.5">
            <span>Occupancy: <strong className="text-white font-bold">{occupancyRate}%</strong></span>
          </div>
        </div>
      </div>

      {/* Occupancy progress bar */}
      <div className="w-full bg-bg-elevated h-1.5 rounded-full overflow-hidden border border-border-default/20">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            occupancyRate > 90 ? 'bg-[#ef4444]' : 'bg-[#3b82f6]'
          }`}
          style={{ width: `${occupancyRate}%` }}
        />
      </div>
    </div>
  );
};
