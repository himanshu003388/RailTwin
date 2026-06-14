import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { X, ArrowRight, Gauge, Users } from 'lucide-react';
import { StationRiskPanel } from '../panels/StationRiskPanel';

const TRAIN_COLORS: Record<string, string> = {
  '12951': '#3b82f6',
  '12007': '#22c55e',
  '12245': '#ef4444',
  '12423': '#a855f7',
  '12801': '#f97316',
  '12625': '#06b6d4',
  '12137': '#ec4899',
  '12301': '#eab308',
};

export const RightSidebar: React.FC = () => {
  const mobileRightOpen = useDemoStore(state => state.mobileRightOpen);
  const setMobileRightOpen = useDemoStore(state => state.setMobileRightOpen);
  const trains = useDemoStore(state => state.trains);
  const lastUpdated = useDemoStore(state => state.lastUpdated);

  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--';

  return (
    <>
      {mobileRightOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden cursor-pointer"
          onClick={() => setMobileRightOpen(false)}
        />
      )}
      <aside className={`w-[320px] right-sidebar h-dvh bg-bg-card border-l border-border-default p-3 max-sm:p-2 flex flex-col gap-3 max-sm:gap-2 overflow-y-auto shrink-0 select-none scrollbar-thin transition-transform duration-300 ease-in-out max-lg:fixed max-lg:top-0 max-lg:bottom-0 max-lg:right-0 max-lg:z-50 max-sm:w-full max-sm:max-w-[300px] sidebar-accent ${
        mobileRightOpen ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'
      }`}>
        <button
          onClick={() => setMobileRightOpen(false)}
          className="hidden max-lg:flex w-7 h-7 items-center justify-center rounded-md bg-bg-sunken border border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default transition-all duration-150 outline-none cursor-pointer shrink-0 self-end"
          title="Close panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Live Train Status */}
        <div
          className="bg-bg-card border border-border-default rounded-lg p-3 select-none"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-[0.1em]">
              Live Trains
            </span>
            <span className="text-[8px] text-text-muted font-mono">
              updated {lastUpdatedStr}
            </span>
          </div>

          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-0.5 scrollbar-thin">
            {trains.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-text-muted">
                <Gauge className="w-6 h-6 mb-2 opacity-40" />
                <span className="text-[10px] font-mono">No train data available</span>
              </div>
            ) : trains.map(train => {
              const isDelayed = train.predictedDelay > 0;
              const isSevere = train.predictedDelay > 30;
              const delayColor = isSevere ? '#ef4444' : isDelayed ? '#f59e0b' : '#22c55e';
              const delayBg = isSevere ? 'rgba(239,68,68,0.08)' : isDelayed ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)';
              const delayBorder = isSevere ? 'rgba(239,68,68,0.25)' : isDelayed ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.20)';
              const delayText = isDelayed ? `+${train.predictedDelay}m` : 'On Time';
              const occupancyRate = Math.round((train.passengerCount / train.capacity) * 100);

              return (
                <div
                  key={train.id}
                  className="group bg-bg-sunken border border-border-subtle rounded-lg p-2.5 flex flex-col gap-1.5 transition-all duration-200 hover:border-border-default"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TRAIN_COLORS[train.id] || '#3b82f6' }} />
                      <span className="text-[11px] font-semibold text-text-primary truncate">{train.name}</span>
                    </div>
                    <span
                      className="text-[9px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded"
                      style={{ color: delayColor, background: delayBg, border: `1px solid ${delayBorder}`, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {delayText}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 px-2 py-1 rounded text-[9px] font-mono" style={{ background: 'var(--color-bg-elevated)' }}>
                    <span className="font-bold uppercase tracking-widest text-text-secondary">{train.currentStation.toUpperCase()}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-text-muted shrink-0" />
                    <span className="font-bold uppercase tracking-widest text-text-secondary">{train.nextStation.toUpperCase()}</span>
                  </div>

                  <div className="flex items-center justify-between text-[8px] font-mono text-text-tertiary">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-2.5 h-2.5 text-text-muted" />
                      {train.speed} km/h
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-2.5 h-2.5 text-text-muted" />
                      {occupancyRate}% full
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Timestamp */}
        <div className="text-center text-[8px] font-mono text-text-muted select-none pointer-events-none -mt-1">
          Positions computed from real-time schedule mapping
        </div>

        <StationRiskPanel />
      </aside>
    </>
  );
};
