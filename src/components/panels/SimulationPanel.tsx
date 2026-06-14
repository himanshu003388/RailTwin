import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Zap, Bot, ArrowDown, CloudRain, CheckCircle, Play, Loader2 } from 'lucide-react';

export const SimulationPanel: React.FC = () => {
  const simulation    = useDemoStore(state => state.simulation);
  const intervention  = useDemoStore(state => state.intervention);
  const resolved      = useDemoStore(state => state.resolved);
  const copilot       = useDemoStore(state => state.copilot);
  const acceptRecommendation = useDemoStore(state => state.acceptRecommendation);
  const generateAIRecommendations = useDemoStore(state => state.generateAIRecommendations);
  const startDemo     = useDemoStore(state => state.startDemo);
  const demoRunning   = useDemoStore(state => state.demoRunning);
  const stations      = useDemoStore(state => state.stations) || [];

  const isSimulationActive = !!simulation;
  const isResolved         = !!resolved;
  const recommendations    = copilot.recommendations || [];

  const flowStations = stations.map(station => {
    const isImpacted = simulation?.stationsImpacted.includes(station.id);
    const isFirstImpacted = simulation?.stationsImpacted[0] === station.id;
    
    let status = 'ok';
    let delay = null;
    
    if (isImpacted) {
      status = isFirstImpacted ? 'impact' : 'cascade';
      if (isResolved && resolved) {
        if (isFirstImpacted) {
          delay = `+${resolved.newCascadeDelay}m`;
        } else {
          delay = 'nominal';
        }
      } else if (simulation) {
        const delayMins = isFirstImpacted 
          ? Math.round(simulation.cascadeDelay * 0.7) 
          : simulation.cascadeDelay;
        delay = `+${delayMins}m`;
      }
    }
    
    return {
      id: station.id,
      name: station.name,
      code: station.code,
      status,
      delay
    };
  });

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary select-none">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border-default pb-2.5 mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-purple" />
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary font-mono font-medium">
            Disruption Monitor
          </h2>
        </div>
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
          isSimulationActive ? 'text-accent-amber' : 'text-text-muted'
        }`}>
          {isSimulationActive ? 'Monsoon Disruption — Patna' : 'No active disruption'}
        </span>
      </div>

      {/* ── Impact Metrics ── */}
      {isSimulationActive && (
        <div className="grid grid-cols-4 max-md:grid-cols-2 gap-2 mb-5">
          {[
            { label: 'Delay',      value: `+${simulation.cascadeDelay}m`,                                    color: simulation.cascadeDelay > 30 ? 'var(--color-accent-red)' : 'var(--color-accent-amber)' },
            { label: 'Issues',     value: `${simulation.conflictsDetected}`,                                  color: 'var(--color-accent-red)'   },
            { label: 'Trains',     value: '3',                                                                color: 'var(--color-accent-amber)' },
            { label: 'At Risk',   value: `${(simulation.passengersAffected / 1000).toFixed(0)}K`,            color: 'var(--color-accent-red)'   },
          ].map(m => (
            <div
              key={m.label}
              className="bg-bg-card border border-border-default p-2.5 rounded-lg text-center flex flex-col justify-center"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <span className="text-[9px] text-text-tertiary font-mono uppercase tracking-wider">{m.label}</span>
              <span className="font-mono text-xs font-bold mt-1" style={{ color: m.color, fontVariantNumeric: 'tabular-nums' }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Station Flow ── */}
      {isSimulationActive ? (
        <div
          className="flex flex-col items-center rounded-xl p-4 mb-5 max-h-[300px] overflow-y-auto scrollbar-thin border border-border-default"
          style={{ background: 'var(--color-bg-card)' }}
        >
          <h3 className="text-[10px] uppercase tracking-[0.12em] text-text-tertiary font-mono font-medium mb-3 w-full border-b border-border-default pb-1.5 text-center">
            Impact Flow
          </h3>
          <div className="flex flex-col items-center gap-1.5 w-full">
            {flowStations.map((station, idx) => {
              const isNormal = station.status === 'ok';
              let cardStyle: React.CSSProperties = {};
              let textClass = 'text-text-tertiary';
              let delayLabel = station.delay;

              const isFirstImpacted = simulation?.stationsImpacted[0] === station.id;

              if (isNormal) {
                cardStyle = { background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-tertiary)' };
              } else if (isResolved) {
                cardStyle = { background: 'var(--color-risk-low-bg)', borderColor: 'var(--color-risk-low)', color: 'var(--color-text-primary)' };
                textClass = 'text-text-primary';
              } else {
                const impactIdx = simulation?.stationsImpacted.indexOf(station.id) ?? 0;
                const redShade = impactIdx === 0 ? 'rgba(239,68,68,0.2)' : impactIdx === 1 ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.06)';
                return (
                  <React.Fragment key={station.id}>
                    {idx > 0 && <ArrowDown className="w-3.5 h-3.5 text-border-active" />}
                    <div className="w-[130px] h-[56px] rounded-lg border flex flex-col justify-center items-center relative overflow-hidden transition-all duration-300 shadow-sm" style={{ background: redShade, borderColor: 'var(--color-accent-red)' }}>
                      {isFirstImpacted && !isResolved && (
                        <CloudRain className="absolute top-1 right-1.5 w-3 h-3 text-accent-red animate-pulse" />
                      )}
                      <span className="text-[11px] font-bold font-mono uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>{station.code}</span>
                      <span className="text-[9px] opacity-80 select-none truncate max-w-[110px]">{station.name}</span>
                      {delayLabel && (
                        <span className="text-[9px] font-mono mt-0.5 font-bold text-accent-red" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {delayLabel}
                        </span>
                      )}
                    </div>
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={station.id}>
                  {idx > 0 && <ArrowDown className="w-3.5 h-3.5 text-border-active" />}
                  <div
                    className="w-[130px] h-[56px] rounded-lg border flex flex-col justify-center items-center relative overflow-hidden transition-all duration-300"
                    style={cardStyle}
                  >
                    {isFirstImpacted && !isResolved && (
                      <CloudRain className="absolute top-1 right-1.5 w-3 h-3 text-accent-red animate-pulse" />
                    )}
                    <span className={`text-[11px] font-bold font-mono uppercase tracking-widest ${textClass}`}>{station.code}</span>
                    <span className="text-[9px] opacity-70 select-none truncate max-w-[110px]">{station.name}</span>
                    {delayLabel && (
                      <span
                        className="text-[9px] font-mono mt-0.5 font-bold"
                        style={{ color: isResolved ? 'var(--color-risk-low)' : 'var(--color-accent-red)', fontVariantNumeric: 'tabular-nums' }}
                      >
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
          <Zap className="w-10 h-10 text-border-default mb-3" />
          <span className="text-sm text-text-secondary font-medium mb-1">No active disruption</span>
          <span className="text-xs text-text-tertiary mb-4 max-w-[260px] leading-relaxed">
            The demo triggers a monsoon disruption at Patna — delays ripple across the corridor
          </span>
          {!demoRunning && (
            <button
              onClick={startDemo}
              className="flex items-center gap-2 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all duration-150 active:scale-[0.98]"
              style={{ background: 'var(--color-accent-blue)', boxShadow: 'var(--glow-blue)' }}
            >
              <Play className="w-3 h-3" />
              Start Demo
            </button>
          )}
        </div>
      )}

      {/* ── Resolution Banner ── */}
      {isSimulationActive && isResolved && resolved && (
        <div
          className="border rounded-lg p-3.5 mb-5 flex gap-2.5 items-start animate-slide-up"
          style={{ background: 'var(--color-risk-low-bg)', borderColor: 'var(--color-risk-low-border)' }}
        >
          <CheckCircle className="w-4 h-4 text-accent-green flex-shrink-0 mt-0.5" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' }} />
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-accent-green font-sans">
              ✓ Fix applied — saved {resolved.minutesSaved} minutes
            </span>
            <span className="text-[10px] text-accent-green opacity-80 mt-1 leading-relaxed">
              Delay reduced from 52 → {resolved.newCascadeDelay} min · {resolved.conflictsResolved} issues fixed · 19,000 passengers notified
            </span>
          </div>
        </div>
      )}

      {/* ── AI Recommendations ── */}
      {isSimulationActive && (
        <div className="flex flex-col flex-1 pb-4">
          <div className="flex items-center gap-1.5 border-b border-border-default pb-1.5 mb-2.5">
            <Bot className="w-4 h-4 text-accent-purple" />
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary font-mono font-medium">
              AI Suggestions
            </h3>
          </div>

          {copilot.thinking ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3 border border-border-default rounded-xl bg-bg-card select-none">
              <Loader2 className="w-5 h-5 text-accent-purple animate-spin" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-text-secondary font-medium">Analyzing live data…</span>
                <span className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Asking AI</span>
              </div>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] scrollbar-thin">
              {recommendations.map(rec => {
                const isPriority1    = rec.priority === 1;
                const alreadyAccepted = !!rec.accepted || !!intervention;
                return (
                  <div
                    key={rec.id}
                    className="rounded-lg p-3 flex flex-col transition-all duration-300 animate-slide-up"
                    style={{
                      background: 'rgba(168,85,247,0.05)',
                      border: `${isPriority1 ? '2' : '1'}px solid ${isPriority1 ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.2)'}`,
                      boxShadow: isPriority1 ? '0 0 12px rgba(168,85,247,0.12)' : 'none',
                    }}
                  >
                    <div className="flex gap-2.5 items-start">
                      <div
                        className="w-5 h-5 rounded-full text-white flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0 select-none"
                        style={{ background: 'var(--color-accent-purple)' }}
                      >
                        {rec.priority}
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[11px] font-medium text-text-primary leading-normal">{rec.action}</p>
                        <span className="text-[10px] text-accent-purple font-semibold">Impact: {rec.impact}</span>
                      </div>
                    </div>

                    {isPriority1 && (
                      <div className="mt-3 flex justify-end">
                        <button
                          disabled={alreadyAccepted}
                          onClick={() => acceptRecommendation(rec.id)}
                          className="text-[10px] font-semibold px-3.5 py-1 rounded transition-all duration-200 outline-none active:scale-[0.98]"
                          style={alreadyAccepted ? {
                            background: 'var(--color-bg-elevated)',
                            color: 'var(--color-text-tertiary)',
                            border: '1px solid var(--color-border-default)',
                            cursor: 'not-allowed',
                          } : {
                            background: 'var(--color-accent-purple)',
                            color: '#fff',
                            border: '1px solid rgba(168,85,247,0.3)',
                            boxShadow: 'var(--glow-purple)',
                          }}
                        >
                          {alreadyAccepted ? 'Fix Applied' : 'Apply Fix'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 px-4 border border-border-default border-dashed rounded-xl bg-bg-card text-center select-none">
              <span className="text-xs text-text-secondary font-medium mb-1">Get AI Suggestions</span>
              <span className="text-[10px] text-text-tertiary mb-3 max-w-[240px] leading-relaxed">
                Ask AI to suggest ways to resolve platform conflicts.
              </span>
              <button
                onClick={generateAIRecommendations}
                className="flex items-center gap-1.5 text-white text-[10px] font-semibold font-mono uppercase tracking-wider px-3.5 py-1.5 rounded transition-all duration-150 active:scale-[0.98] cursor-pointer hover:brightness-115"
                style={{ background: 'var(--color-accent-purple)', boxShadow: 'var(--glow-purple)' }}
              >
                <Bot className="w-3.5 h-3.5" />
                Get Suggestions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
