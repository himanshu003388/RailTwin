import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CORRIDOR } from '../../data/corridor';
import { TestTube, Zap, Users, Clock, AlertTriangle, ChevronDown } from 'lucide-react';

const SCENARIOS = [
  { id: 'rainfall' as const, label: 'Heavy Rainfall', icon: '🌧️', description: 'Monsoon downpour causing waterlogging and speed restrictions' },
  { id: 'signal_failure' as const, label: 'Signal Failure', icon: '🔴', description: 'Electronic interlocking system malfunction' },
  { id: 'track_damage' as const, label: 'Track Damage', icon: '⚡', description: 'Rail fracture or ballast erosion requiring immediate halt' },
  { id: 'fog' as const, label: 'Dense Fog', icon: '🌫️', description: 'Visibility below 50m causing severe speed restrictions' },
];

export const WhatIfPanel: React.FC = () => {
  const whatIfStation = useDemoStore(state => state.whatIfStation);
  const whatIfScenario = useDemoStore(state => state.whatIfScenario);
  const whatIfResult = useDemoStore(state => state.whatIfResult);
  const setWhatIfStation = useDemoStore(state => state.setWhatIfStation);
  const setWhatIfScenario = useDemoStore(state => state.setWhatIfScenario);
  const runWhatIf = useDemoStore(state => state.runWhatIf);
  const trains = useDemoStore(state => state.trains);

  const selectedStation = CORRIDOR.stations.find(s => s.id === whatIfStation);

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default pb-2.5 mb-4">
        <div className="flex items-center gap-2">
          <TestTube className="w-4 h-4 text-[#f59e0b]" />
          <h2 className="text-xs uppercase tracking-[0.12em] text-[#555] font-medium">
            What-If Scenario Builder
          </h2>
        </div>
        <span className="text-[10px] font-mono text-[#555]">Interactive Simulator</span>
      </div>

      {/* Configuration Section */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Station Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[#555] font-mono uppercase tracking-wider">Target Station</label>
          <div className="relative">
            <select
              value={whatIfStation}
              onChange={e => setWhatIfStation(e.target.value)}
              className="w-full bg-[#111111] border border-[#333] hover:border-[#555] focus:border-[#f59e0b] rounded-lg text-xs text-white px-3 py-2 outline-none transition-colors appearance-none cursor-pointer font-mono"
            >
              {CORRIDOR.stations.map(station => (
                <option key={station.id} value={station.id}>
                  {station.code} — {station.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#555] pointer-events-none" />
          </div>
        </div>

        {/* Scenario Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[#555] font-mono uppercase tracking-wider">Disruption Type</label>
          <div className="relative">
            <select
              value={whatIfScenario}
              onChange={e => setWhatIfScenario(e.target.value as any)}
              className="w-full bg-[#111111] border border-[#333] hover:border-[#555] focus:border-[#f59e0b] rounded-lg text-xs text-white px-3 py-2 outline-none transition-colors appearance-none cursor-pointer font-mono"
            >
              {SCENARIOS.map(s => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#555] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Scenario Description */}
      <div className="bg-bg-card border border-border-default rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <span className="text-lg">{SCENARIOS.find(s => s.id === whatIfScenario)?.icon}</span>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white">
              {SCENARIOS.find(s => s.id === whatIfScenario)?.label} at {selectedStation?.name}
            </span>
            <span className="text-[10px] text-[#888] leading-relaxed">
              {SCENARIOS.find(s => s.id === whatIfScenario)?.description}
            </span>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runWhatIf}
        className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-mono font-semibold py-2.5 rounded-lg transition-all duration-200 outline-none active:scale-[0.98] mb-4 shadow-md"
      >
        Run Simulation Analysis
      </button>

      {/* Results */}
      {whatIfResult && (
        <div className="flex flex-col gap-3 animate-slide-up">
          {/* Impact Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-bg-card border border-border-default p-2.5 rounded-lg text-center">
              <Clock className="w-3.5 h-3.5 text-accent-red mx-auto mb-1" />
              <span className="text-[9px] text-text-secondary font-mono uppercase block">Cascade</span>
              <span className="text-sm font-mono font-bold text-[#ef4444]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                +{whatIfResult.cascadeDelay}m
              </span>
            </div>
            <div className="bg-bg-card border border-border-default p-2.5 rounded-lg text-center">
              <Zap className="w-3.5 h-3.5 text-accent-amber mx-auto mb-1" />
              <span className="text-[9px] text-text-secondary font-mono uppercase block">Conflicts</span>
              <span className="text-sm font-mono font-bold text-[#f59e0b]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {whatIfResult.conflictsGenerated}
              </span>
            </div>
            <div className="bg-bg-card border border-border-default p-2.5 rounded-lg text-center">
              <Users className="w-3.5 h-3.5 text-accent-purple mx-auto mb-1" />
              <span className="text-[9px] text-text-secondary font-mono uppercase block">Passengers</span>
              <span className="text-sm font-mono font-bold text-[#a855f7]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {(whatIfResult.passengersAtRisk / 1000).toFixed(0)}K
              </span>
            </div>
          </div>

          {/* Affected Trains */}
          <div className="bg-bg-card border border-border-default rounded-lg p-3">
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider block mb-2">
              Affected Trains ({whatIfResult.affectedTrains.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {whatIfResult.affectedTrains.map(trainId => {
                const train = trains.find(t => t.id === trainId);
                return (
                  <span
                    key={trainId}
                    className="bg-[#1a0000] border border-[#ef4444]/30 text-[#ef4444] text-[10px] font-mono px-2 py-0.5 rounded"
                  >
                    {trainId} {train ? `(${train.name.split(' ')[0]})` : ''}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Station Risk Cascade */}
          <div className="bg-bg-card border border-border-default rounded-lg p-3">
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider block mb-2">
              Risk Cascade Propagation
            </span>
            <div className="flex flex-col gap-1.5">
              {Object.entries(whatIfResult.riskLevels).map(([stationId, risks]) => {
                const station = CORRIDOR.stations.find(s => s.id === stationId);
                const isSource = stationId === whatIfStation;
                return (
                  <div
                    key={stationId}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] font-mono ${
                      isSource ? 'bg-[#1a0000] border border-[#ef4444]/30' : 'bg-bg-elevated border border-border-default'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isSource ? 'text-[#ef4444]' : 'text-white'}`}>
                        {station?.code}
                      </span>
                      <span className="text-[#555]">{station?.name}</span>
                      {isSource && <span className="text-[8px] bg-[#ef4444]/20 text-[#ef4444] px-1 rounded">SOURCE</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] ${
                        risks.crowdRisk === 'critical' ? 'text-[#ef4444]' :
                        risks.crowdRisk === 'high' ? 'text-[#f97316]' :
                        risks.crowdRisk === 'moderate' ? 'text-[#f59e0b]' : 'text-[#22c55e]'
                      }`}>
                        {risks.crowdRisk.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!whatIfResult && (
        <div className="flex-1 flex flex-col items-center justify-center border border-border-default border-dashed rounded-xl py-8 text-center select-none">
          <TestTube className="w-10 h-10 text-[#222222] mb-3" />
          <span className="text-sm text-[#888888] font-medium mb-1">No scenario results</span>
          <span className="text-xs text-[#555555] max-w-[260px] leading-relaxed">
            Select a station and disruption type above, then click "Run Simulation Analysis" to see projected cascade impact
          </span>
        </div>
      )}

      <div className="mt-3 text-[10px] text-text-tertiary text-center font-mono uppercase tracking-wider">
        What-If Simulator · Cascade Impact Analysis
      </div>
    </div>
  );
};
