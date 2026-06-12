import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { TestTube, Zap, Users, Clock, ChevronDown } from 'lucide-react';

const SCENARIOS = [
  { id: 'signal_failure'as const, label: 'Signal Failure',  icon: '🔴', description: 'Electronic interlocking system malfunction' },
  { id: 'track_damage'  as const, label: 'Track Damage',    icon: '⚡', description: 'Rail fracture or ballast erosion requiring immediate halt' },
];

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  color: 'var(--color-text-primary)',
  fontSize: 12,
  padding: '7px 28px 7px 10px',
  outline: 'none',
  appearance: 'none' as any,
  WebkitAppearance: 'none' as any,
  cursor: 'pointer',
  fontFamily: 'monospace',
  transition: 'border-color 0.15s',
};

export const WhatIfPanel: React.FC = () => {
  const whatIfStation  = useDemoStore(state => state.whatIfStation);
  const whatIfScenario = useDemoStore(state => state.whatIfScenario);
  const whatIfResult   = useDemoStore(state => state.whatIfResult);
  const setWhatIfStation  = useDemoStore(state => state.setWhatIfStation);
  const setWhatIfScenario = useDemoStore(state => state.setWhatIfScenario);
  const runWhatIf      = useDemoStore(state => state.runWhatIf);
  const trains         = useDemoStore(state => state.trains);
  const stations       = useDemoStore(state => state.stations) || [];

  const selectedStation = stations.find(s => s.id === whatIfStation);
  const activeScenario  = SCENARIOS.find(s => s.id === whatIfScenario);

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary select-none">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border-default pb-2.5 mb-4">
        <div className="flex items-center gap-2">
          <TestTube className="w-4 h-4 text-accent-amber" />
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary font-mono font-medium">
            What-If Scenario Builder
          </h2>
        </div>
        <span className="text-[10px] font-mono text-text-muted">Interactive Simulator</span>
      </div>

      {/* ── Config Selects ── */}
      <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Target Station</label>
          <div className="relative">
            <select
              value={whatIfStation}
              onChange={e => setWhatIfStation(e.target.value)}
              style={selectStyle}
              onFocus={e  => (e.currentTarget.style.borderColor = 'var(--color-accent-amber)')}
              onBlur={e   => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            >
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Disruption Type</label>
          <div className="relative">
            <select
              value={whatIfScenario}
              onChange={e => setWhatIfScenario(e.target.value as any)}
              style={selectStyle}
              onFocus={e  => (e.currentTarget.style.borderColor = 'var(--color-accent-amber)')}
              onBlur={e   => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            >
              {SCENARIOS.map(s => (
                <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
        </div>
      </div>

      {/* ── Scenario Description ── */}
      <div
        className="rounded-lg p-3 mb-4 border border-border-default"
        style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start gap-2">
          <span className="text-lg">{activeScenario?.icon}</span>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-text-primary">{activeScenario?.label} at {selectedStation?.name}</span>
            <span className="text-[10px] text-text-tertiary leading-relaxed">{activeScenario?.description}</span>
          </div>
        </div>
      </div>

      {/* ── Run Button ── */}
      <button
        onClick={runWhatIf}
        className="w-full text-white text-xs font-mono font-semibold py-2.5 rounded-lg transition-all duration-200 outline-none active:scale-[0.98] mb-4"
        style={{
          background: 'var(--color-accent-amber)',
          boxShadow: 'var(--glow-amber)',
        }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.filter = '')}
      >
        Run Simulation Analysis
      </button>

      {/* ── Results ── */}
      {whatIfResult ? (
        <div className="flex flex-col gap-3 animate-slide-up">
          <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-2">
            {[
              { icon: <Clock className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: 'var(--color-accent-red)' }} />,    label: 'Cascade', value: `+${whatIfResult.cascadeDelay}m`,                          color: 'var(--color-accent-red)'    },
              { icon: <Zap   className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: 'var(--color-accent-amber)' }} />,  label: 'Conflicts', value: `${whatIfResult.conflictsGenerated}`,                    color: 'var(--color-accent-amber)'  },
              { icon: <Users className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: 'var(--color-accent-purple)' }} />, label: 'Passengers', value: `${(whatIfResult.passengersAtRisk/1000).toFixed(0)}K`, color: 'var(--color-accent-purple)' },
            ].map(m => (
              <div
                key={m.label}
                className="border border-border-default p-2.5 rounded-lg text-center"
                style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-card)' }}
              >
                {m.icon}
                <span className="text-[9px] text-text-tertiary font-mono uppercase block">{m.label}</span>
                <span className="text-sm font-mono font-bold" style={{ color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Affected Trains */}
          <div className="border border-border-default rounded-lg p-3" style={{ background: 'var(--color-bg-card)' }}>
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider block mb-2">
              Affected Trains ({whatIfResult.affectedTrains.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {whatIfResult.affectedTrains.map(trainId => {
                const t = trains.find(tr => tr.id === trainId);
                return (
                  <span
                    key={trainId}
                    className="text-[10px] font-mono px-2 py-0.5 rounded"
                    style={{ background: 'var(--color-risk-critical-bg)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-accent-red)' }}
                  >
                    {trainId} {t ? `(${t.name.split(' ')[0]})` : ''}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Station Risk Cascade */}
          <div className="border border-border-default rounded-lg p-3" style={{ background: 'var(--color-bg-card)' }}>
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider block mb-2">
              Risk Cascade Propagation
            </span>
            <div className="flex flex-col gap-1.5">
              {Object.entries(whatIfResult.riskLevels).map(([stationId, risks]) => {
                const station  = stations.find(s => s.id === stationId);
                const isSource = stationId === whatIfStation;
                const riskColor = risks.crowdRisk === 'critical' ? 'var(--color-risk-critical)'  :
                                  risks.crowdRisk === 'high'     ? 'var(--color-risk-high)'       :
                                  risks.crowdRisk === 'moderate' ? 'var(--color-risk-moderate)'   : 'var(--color-risk-low)';
                return (
                  <div
                    key={stationId}
                    className="flex items-center justify-between px-2 py-1.5 rounded text-[10px] font-mono"
                    style={{
                      background:   isSource ? 'var(--color-risk-critical-bg)' : 'var(--color-bg-elevated)',
                      border:       `1px solid ${isSource ? 'rgba(239,68,68,0.3)' : 'var(--color-border-default)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: isSource ? 'var(--color-accent-red)' : 'var(--color-text-primary)' }}>
                        {station?.code}
                      </span>
                      <span className="text-text-tertiary">{station?.name}</span>
                      {isSource && (
                        <span className="text-[8px] px-1 rounded" style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--color-accent-red)' }}>
                          SOURCE
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-semibold uppercase" style={{ color: riskColor, letterSpacing: '0.05em' }}>
                      {risks.crowdRisk}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border border-border-default border-dashed rounded-xl py-8 text-center">
          <TestTube className="w-10 h-10 text-border-default mb-3" />
          <span className="text-sm text-text-secondary font-medium mb-1">No scenario results</span>
          <span className="text-xs text-text-tertiary max-w-[260px] leading-relaxed">
            Select a station and disruption type above, then click "Run Simulation Analysis"
          </span>
        </div>
      )}

      <div className="mt-3 text-[10px] text-text-muted text-center font-mono uppercase tracking-wider">
        What-If Simulator · Cascade Impact Analysis
      </div>
    </div>
  );
};
