import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CORRIDOR } from '../../data/corridor';
import { Activity, Train, Clock, Users, Gauge, AlertTriangle } from 'lucide-react';

const GaugeBar: React.FC<{ value: number; max?: number; color: string; label: string; glow?: string }> = ({
  value, max = 100, color, label, glow,
}) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-[0.08em]">{label}</span>
        <span className="text-[11px] font-mono font-bold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
          {value}%
        </span>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: glow ?? `0 0 8px ${color}55`,
          }}
        />
      </div>
    </div>
  );
};

const MetricTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div
    className="bg-bg-elevated border border-border-default rounded-lg p-3 flex flex-col gap-1.5"
    style={{ boxShadow: 'var(--shadow-card)' }}
  >
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[9px] text-text-tertiary font-mono uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-lg font-mono font-bold text-text-primary leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
  </div>
);

export const HealthDashboard: React.FC = () => {
  const networkHealth = useDemoStore(state => state.networkHealth);
  const trains        = useDemoStore(state => state.trains);
  const stationRisks  = useDemoStore(state => state.stationRisks);
  const stations      = useDemoStore(state => state.stations) || [];
  const simulation    = useDemoStore(state => state.simulation);
  const weatherAlert  = useDemoStore(state => state.weatherAlert);
  const predictions   = useDemoStore(state => state.predictions);
  const resolved      = useDemoStore(state => state.resolved);

  const totalPassengers = trains.reduce((s, t) => s + t.passengerCount, 0);
  const avgSpeed        = trains.length > 0
    ? Math.round(trains.reduce((s, t) => s + t.speed, 0) / trains.length)
    : 0;

  const statusColor = networkHealth.signalStatus === 'operational'
    ? 'var(--color-accent-green)'
    : networkHealth.signalStatus === 'degraded'
    ? 'var(--color-accent-amber)'
    : 'var(--color-accent-red)';

  const RISK_COLOR = (r: string) =>
    r === 'critical' ? 'var(--color-risk-critical)'
    : r === 'high'   ? 'var(--color-risk-high)'
    : r === 'moderate'? 'var(--color-risk-moderate)'
    :                   'var(--color-risk-low)';

  const systems = [
    { label: 'Weather Monitor',    active: !!weatherAlert,           color: weatherAlert ? 'var(--color-accent-amber)' : 'var(--color-accent-green)', pulse: !!weatherAlert },
    { label: 'Cascade Engine',     active: !!simulation,             color: simulation   ? 'var(--color-accent-amber)' : 'var(--color-accent-green)', pulse: !!simulation   },
    { label: 'Signal Control',     active: true,                     color: 'var(--color-accent-green)', pulse: false },
    { label: 'AI Copilot',         active: true,                     color: 'var(--color-accent-green)', pulse: false },
    { label: 'Prediction Engine',  active: predictions.length > 0,   color: predictions.length > 0 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)', pulse: predictions.length > 0 },
    { label: 'Resolution Active',  active: !!resolved,               color: resolved ? 'var(--color-accent-green)' : 'var(--color-border-active)', pulse: false },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary select-none animate-panel-in overflow-y-auto scrollbar-thin pr-0.5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border-default pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-green" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' }} />
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary font-mono font-medium">
            System Health Dashboard
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
          />
          <span className="text-[10px] font-mono font-bold uppercase" style={{ color: statusColor, letterSpacing: '0.06em' }}>
            {networkHealth.signalStatus}
          </span>
        </div>
      </div>

      {/* ── Network Gauges ── */}
      <div
        className="bg-bg-card border border-border-default rounded-lg p-3 mb-4 flex flex-col gap-3 shrink-0"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <GaugeBar value={networkHealth.efficiency} color="var(--color-accent-blue)"   label="Network Efficiency"    />
        <GaugeBar value={networkHealth.onTimePerf} color="var(--color-accent-green)"  label="On-Time Performance"   />
        <GaugeBar value={networkHealth.platformUtil} color="var(--color-accent-purple)" label="Platform Utilization" />
      </div>

      {/* ── Key Metrics Grid ── */}
      <div className="grid grid-cols-2 gap-2 mb-4 shrink-0">
        <MetricTile
          icon={<Train className="w-3.5 h-3.5 text-accent-blue" />}
          label="Active Trains"
          value={trains.length}
        />
        <MetricTile
          icon={<Users className="w-3.5 h-3.5 text-accent-purple" />}
          label="Passengers"
          value={<>{(totalPassengers / 1000).toFixed(1)}<span className="text-xs text-text-tertiary ml-0.5">K</span></>}
        />
        <MetricTile
          icon={<Gauge className="w-3.5 h-3.5 text-accent-amber" />}
          label="Avg Speed"
          value={<>{avgSpeed}<span className="text-xs text-text-tertiary ml-0.5">km/h</span></>}
        />
        <MetricTile
          icon={<AlertTriangle className="w-3.5 h-3.5 text-accent-red" />}
          label="Active Alerts"
          value={
            <span style={{ color: networkHealth.activeAlerts > 0 ? 'var(--color-accent-red)' : 'var(--color-accent-green)' }}>
              {networkHealth.activeAlerts}
            </span>
          }
        />
      </div>

      {/* ── Station Risk Summary ── */}
      <div
        className="bg-bg-card border border-border-default rounded-lg p-3 mb-4 shrink-0"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-[0.08em] block mb-2.5">
          Station Risk Summary
        </span>
        <div className="flex flex-col gap-0">
          {stations.map(station => {
            const risk = stationRisks[station.id];
            const rc = RISK_COLOR(risk.crowdRisk);
            return (
              <div
                key={station.id}
                className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 transition-colors duration-150 hover:bg-bg-elevated rounded-sm px-1"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: rc, boxShadow: `0 0 5px ${rc}99` }}
                  />
                  <span className="text-[10px] font-mono text-text-secondary font-semibold">{station.code}</span>
                  <span className="text-[9px] text-text-tertiary truncate max-w-[80px]">{station.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {risk.platformConflicts > 0 && (
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded font-mono font-semibold"
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        color: 'var(--color-accent-red)',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}
                    >
                      {risk.platformConflicts} conflicts
                    </span>
                  )}
                  <span
                    className="text-[9px] font-mono uppercase font-semibold"
                    style={{ color: rc, letterSpacing: '0.05em' }}
                  >
                    {risk.crowdRisk}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Active Systems ── */}
      <div
        className="bg-bg-card border border-border-default rounded-lg p-3 shrink-0"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-[0.08em] block mb-2.5">
          Active Systems
        </span>
        <div className="grid grid-cols-2 gap-y-2 gap-x-3">
          {systems.map(sys => (
            <div key={sys.label} className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${sys.pulse ? 'animate-pulse' : ''}`}
                style={{
                  backgroundColor: sys.color,
                  boxShadow: sys.active ? `0 0 5px ${sys.color}99` : undefined,
                }}
              />
              <span className="text-[9px] text-text-tertiary font-mono truncate">{sys.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-[9px] text-text-muted text-center font-mono uppercase tracking-wider pb-1 shrink-0">
        Real-Time Monitoring · RailTwin AI
      </div>
    </div>
  );
};
