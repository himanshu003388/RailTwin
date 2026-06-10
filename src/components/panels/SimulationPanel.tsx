import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Zap, Bot, ArrowDown, CloudRain, CheckCircle, Play } from 'lucide-react';

export const SimulationPanel: React.FC = () => {
  const simulation = useDemoStore(state => state.simulation);
  const intervention = useDemoStore(state => state.intervention);
  const resolved = useDemoStore(state => state.resolved);
  const copilot = useDemoStore(state => state.copilot);
  const acceptRecommendation = useDemoStore(state => state.acceptRecommendation);
  const startDemo = useDemoStore(state => state.startDemo);
  const demoRunning = useDemoStore(state => state.demoRunning);

  const isSimulationActive = !!simulation;
  const isResolved = !!resolved;

  // Recommendations list
  const recommendations = copilot.recommendations || [];

  // Stations for flow diagram
  const flowStations = [
    { id: 'ndls', name: 'New Delhi', code: 'NDLS', status: 'ok', delay: null },
    { id: 'cnb', name: 'Kanpur Central', code: 'CNB', status: 'ok', delay: null },
    { id: 'alld', name: 'Prayagraj Jt', code: 'ALD', status: 'ok', delay: null },
    { id: 'pnbe', name: 'Patna Jt', code: 'impact', delay: '+38m' },
    { id: 'dhn', name: 'Dhanbad Jt', code: 'cascade', delay: '+52m' },
    { id: 'hwh', name: 'Howrah Jt', code: 'cascade', delay: '+52m' }
  ];

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary select-none">
      {/* SECTION A — Simulation Header */}
      <div className="flex items-center justify-between border-b border-border-default pb-2.5 mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#a855f7]" />
          <h2 className="text-xs uppercase tracking-[0.12em] text-[#555] font-medium">
            Cascade Simulation Engine
          </h2>
        </div>
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
          isSimulationActive ? 'text-accent-amber' : 'text-text-tertiary'
        }`}>
          {isSimulationActive ? 'Monsoon Disruption — Patna' : 'No active scenario'}
        </span>
      </div>

      {/* SECTION B — Impact Metrics Row */}
      {isSimulationActive && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          {/* Cascade Delay */}
          <div className="bg-[#111111] border border-[#222222] p-2.5 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[9px] text-[#888888] font-mono uppercase tracking-wider">Delay</span>
            <span className={`font-mono text-xs font-bold mt-1 ${
              simulation.cascadeDelay > 30 ? 'text-[#ef4444]' : 'text-[#f59e0b]'
            }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
              +{simulation.cascadeDelay}m
            </span>
          </div>

          {/* Platform Conflicts */}
          <div className="bg-[#111111] border border-[#222222] p-2.5 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[9px] text-[#888888] font-mono uppercase tracking-wider">Conflicts</span>
            <span className="font-mono text-xs font-bold mt-1 text-[#ef4444]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {simulation.conflictsDetected}
            </span>
          </div>

          {/* Affected Trains */}
          <div className="bg-[#111111] border border-[#222222] p-2.5 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[9px] text-[#888888] font-mono uppercase tracking-wider">Trains</span>
            <span className="font-mono text-xs font-bold mt-1 text-[#f59e0b]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              3
            </span>
          </div>

          {/* Passengers at Risk */}
          <div className="bg-[#111111] border border-[#222222] p-2.5 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[9px] text-[#888888] font-mono uppercase tracking-wider">Risk Paxs</span>
            <span className="font-mono text-xs font-bold mt-1 text-[#ef4444]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {(simulation.passengersAffected / 1000).toFixed(0)}K
            </span>
          </div>
        </div>
      )}

      {/* SECTION C — Station Impact Flow */}
      {isSimulationActive ? (
        <div className="flex flex-col items-center bg-bg-card/30 border border-border-default rounded-xl p-4 mb-5 max-h-[300px] overflow-y-auto">
          <h3 className="text-xs uppercase tracking-[0.12em] text-text-tertiary font-medium mb-3 w-full border-b border-border-default pb-1.5 text-center">
            Disruption Propagation Chain
          </h3>
          <div className="flex flex-col items-center gap-1.5 w-full">
            {flowStations.map((station, idx) => {
              const isNormal = station.status === 'ok';

              // Determine classes for affected stations based on simulation / resolution state
              let cardClass = '';
              let delayLabel = station.delay;

              if (isNormal) {
                // NDLS, CNB, ALD are always nominal
                cardClass = 'bg-[#111111] border-[#222222] text-[#888888]';
              } else if (isResolved) {
                // If resolved, Patna and cascade stations turn green
                if (station.id === 'pnbe') {
                  cardClass = 'bg-[#001a00] border-[#22c55e] text-white';
                  delayLabel = '+19m'; // reduced delay
                } else {
                  cardClass = 'bg-[#001a00] border-[#22c55e] text-white';
                  delayLabel = 'nominal';
                }
              } else {
                // If active but unresolved, use cascading animation delays
                if (station.id === 'pnbe') {
                  cardClass = 'animate-turn-red-0';
                } else if (station.id === 'dhn') {
                  cardClass = 'animate-turn-red-400';
                } else {
                  cardClass = 'animate-turn-red-800';
                }
              }

              return (
                <React.Fragment key={station.id}>
                  {/* Arrow separator (skip before first element) */}
                  {idx > 0 && <ArrowDown className="w-3.5 h-3.5 text-[#222222]" />}

                  {/* Station box */}
                  <div className={`w-[130px] h-[56px] rounded-lg border flex flex-col justify-center items-center relative overflow-hidden transition-all duration-300 shadow-sm ${cardClass}`}>
                    {/* Patna Rain Icon overlay */}
                    {station.id === 'pnbe' && !isResolved && (
                      <CloudRain className="absolute top-1 right-1.5 w-3 h-3 text-[#ef4444] animate-pulse" />
                    )}

                    <span className="text-[11px] font-bold font-mono uppercase tracking-widest text-[#555]">{station.code}</span>
                    <span className="text-[9px] opacity-80 select-none truncate max-w-[110px]">{station.name}</span>

                    {/* Delay indicator below code */}
                    {delayLabel && (
                      <span className={`text-[9px] font-mono mt-0.5 font-bold ${
                        isResolved ? 'text-[#22c55e]' : 'text-[#ef4444]'
                      }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {delayLabel}
                      </span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border border-border-default border-dashed rounded-xl py-12 px-6 text-center select-none mb-5">
          <Zap className="w-10 h-10 text-[#222222] mb-3" />
          <span className="text-sm text-[#888888] font-medium mb-1">No active simulation</span>
          <span className="text-xs text-[#555555] mb-4 max-w-[260px] leading-relaxed">
            The demo triggers a monsoon disruption at Patna, causing cascading delays across the corridor
          </span>
          {!demoRunning && (
            <button
              onClick={startDemo}
              className="flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-medium px-4 py-2 rounded-lg transition-all duration-150 active:scale-[0.98]"
            >
              <Play className="w-3 h-3" />
              Start Demo
            </button>
          )}
        </div>
      )}

      {/* SECTION E — Resolution Banner */}
      {isSimulationActive && isResolved && resolved && (
        <div className="bg-[#052e16] border border-[#166534] rounded-lg p-3.5 mb-5 flex gap-2.5 items-start animate-slide-up shadow-md">
          <CheckCircle className="w-4.5 h-4.5 text-[#22c55e] flex-shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#22c55e] font-sans">
              ✓ Intervention Applied — {resolved.minutesSaved} minutes saved
            </span>
            <span className="text-[10px] text-[#22c55e] opacity-90 mt-1 leading-relaxed">
              Cascade delay reduced from 52 → {resolved.newCascadeDelay} minutes · {resolved.conflictsResolved} conflicts resolved · 19,000 passengers notified
            </span>
          </div>
        </div>
      )}

      {/* SECTION D — AI Recommendations */}
      {isSimulationActive && recommendations.length > 0 && (
        <div className="flex flex-col flex-1 pb-4">
          <div className="flex items-center gap-1.5 border-b border-border-default pb-1.5 mb-2.5">
            <Bot className="w-4 h-4 text-[#a855f7]" />
            <h3 className="text-xs uppercase tracking-[0.12em] text-[#555] font-medium">
              AI Copilot Recommendations
            </h3>
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px]">
            {recommendations.map(rec => {
              const isPriority1 = rec.priority === 1;
              const alreadyAccepted = !!rec.accepted || !!intervention;

              return (
                <div
                  key={rec.id}
                  className={`bg-[#0f0a1a] rounded-lg p-3 flex flex-col transition-all duration-300 ${
                    isPriority1
                      ? 'border-2 border-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.1)]'
                      : 'border border-[#2d1b6b]/60'
                  }`}
                >
                  <div className="flex gap-2.5 items-start">
                    {/* Priority circle */}
                    <div className="w-5 h-5 rounded-full bg-[#a855f7] text-white flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0 select-none">
                      {rec.priority}
                    </div>

                    <div className="flex-1 flex flex-col gap-1">
                      <p className="text-[11px] font-medium text-white leading-normal">
                        {rec.action}
                      </p>
                      <span className="text-[10px] text-[#a855f7] font-semibold">
                        Impact: {rec.impact}
                      </span>
                    </div>
                  </div>

                  {/* Accept CTA on priority 1 recommendation */}
                  {isPriority1 && (
                    <div className="mt-3 flex justify-end">
                      <button
                        disabled={alreadyAccepted}
                        onClick={() => acceptRecommendation(rec.id)}
                        className={`text-[10px] font-semibold px-3.5 py-1 rounded transition-all duration-200 outline-none active:scale-[0.98] ${
                          alreadyAccepted
                            ? 'bg-[#1a1a1a] text-[#555555] border border-[#222222] cursor-not-allowed'
                            : 'bg-[#a855f7] text-white hover:bg-[#9333ea] border border-[#a855f7]/20 shadow-sm'
                        }`}
                      >
                        {alreadyAccepted ? 'Intervention Active' : 'Accept Mitigation'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
