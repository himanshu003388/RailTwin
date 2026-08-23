import React from 'react';
import { useDemoStore, getTrainRiskLevel, getStationCompositeRisk } from '../../stores/demoStore';
import {
  Activity,
  Train,
  Users,
  Gauge,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Radio,
  CloudRain,
  CloudFog,
} from 'lucide-react';
import { RiskBadge } from '../ui/RiskBadge';

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
  className?: string;
}> = ({ icon, label, value, className }) => (
  <div
    className={`bg-bg-elevated border border-border-default rounded-lg p-3 flex flex-col gap-1.5 animate-card-entrance ${className ?? ''}`}
    style={{ boxShadow: 'var(--shadow-card)' }}
  >
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[9px] text-text-tertiary font-mono uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-lg font-mono font-bold text-text-primary leading-none animate-count" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
  </div>
);

const TRAIN_COLORS: Record<string, string> = {
  '12951': '#3b82f6',
  '12007': '#22c55e',
  '12423': '#a855f7',
  '12801': '#f97316',
  '12625': '#06b6d4',
  '12137': '#ec4899',
  '12301': '#eab308',
};

export const HealthDashboard: React.FC = () => {
  const loading = useDemoStore(state => state.loading);
  const networkHealth = useDemoStore(state => state.networkHealth);
  const trains        = useDemoStore(state => state.trains);
  const stationRisks  = useDemoStore(state => state.stationRisks);
  const stations      = useDemoStore(state => state.stations) || [];
  const simulation    = useDemoStore(state => state.simulation);
  const weatherAlert  = useDemoStore(state => state.weatherAlert);
  const weatherData   = useDemoStore(state => state.weatherData);
  const predictions   = useDemoStore(state => state.predictions);
  const resolved      = useDemoStore(state => state.resolved);

  const totalPassengers = trains.reduce((s, t) => s + (t.passengerCount || 0), 0);
  const avgSpeed        = trains.length > 0
    ? Math.round(trains.reduce((s, t) => s + (t.speed || 0), 0) / trains.length)
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

  // Calculate live train risk assessments
  const trainAssessments = trains.map(train => {
    const targetStation = train.nextStation || train.currentStation;
    const stWeather = weatherData?.[targetStation];
    const risk = getTrainRiskLevel(train, stWeather);
    return { train, targetStation, stWeather, risk };
  });

  const riskCounts = {
    critical: trainAssessments.filter(t => t.risk.level === 'critical').length,
    high: trainAssessments.filter(t => t.risk.level === 'high').length,
    moderate: trainAssessments.filter(t => t.risk.level === 'moderate').length,
    low: trainAssessments.filter(t => t.risk.level === 'low').length,
  };

  const systems = [
    {
      label: 'Weather Radar Feed',
      active: true,
      color: weatherAlert ? 'var(--color-accent-amber)' : 'var(--color-accent-green)',
      pulse: !!weatherAlert,
      detail: weatherAlert ? `Alert at ${weatherAlert.station.toUpperCase()}` : 'Nominal',
    },
    {
      label: 'Disruption & Sim Engine',
      active: !!simulation,
      color: simulation ? 'var(--color-accent-red)' : 'var(--color-accent-green)',
      pulse: !!simulation,
      detail: simulation ? `${simulation.conflictsDetected} conflicts active` : 'Clear',
    },
    {
      label: 'Signal & Interlocking',
      active: true,
      color: networkHealth.signalStatus === 'operational' ? 'var(--color-accent-green)' : networkHealth.signalStatus === 'degraded' ? 'var(--color-accent-amber)' : 'var(--color-accent-red)',
      pulse: networkHealth.signalStatus !== 'operational',
      detail: networkHealth.signalStatus.toUpperCase(),
    },
    {
      label: 'AI Copilot Dispatch',
      active: true,
      color: 'var(--color-accent-purple)',
      pulse: false,
      detail: 'Operational',
    },
    {
      label: 'Delay Predictor (ML Ridge)',
      active: predictions.length > 0,
      color: predictions.length > 0 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)',
      pulse: predictions.length > 0,
      detail: `${predictions.length} warnings`,
    },
    {
      label: 'Drift Reconciler Ledger',
      active: true,
      color: resolved ? 'var(--color-accent-green)' : 'var(--color-accent-blue)',
      pulse: false,
      detail: resolved ? 'Mitigation Live' : 'Synchronized',
    },
  ];

  if (loading && trains.length === 0) {
    return (
      <div className="flex flex-col h-full bg-bg-page text-text-primary items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-[10px] font-mono text-text-muted">Loading network health telemetry...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary select-none animate-panel-in overflow-y-auto scrollbar-thin pr-0.5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border-default pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-green" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' }} />
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary font-mono font-medium">
            System Health & Operations Telemetry
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider hidden sm:inline">
            Status:
          </span>
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border"
            style={{
              borderColor: `color-mix(in srgb, ${statusColor} 40%, transparent)`,
              background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
            />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: statusColor }}>
              {networkHealth.signalStatus}
            </span>
          </div>
        </div>
      </div>

      {/* ── Network Gauges ── */}
      <div
        className="bg-bg-card border border-border-default rounded-lg p-3.5 mb-4 flex flex-col gap-3.5 shrink-0"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <GaugeBar
          value={networkHealth.efficiency}
          color="var(--color-accent-blue)"
          label="Network Efficiency Rating"
          glow="0 0 10px rgba(59,130,246,0.5)"
        />
        <GaugeBar
          value={networkHealth.onTimePerf}
          color={networkHealth.onTimePerf < 60 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)'}
          label="On-Time Performance Rate"
          glow={networkHealth.onTimePerf < 60 ? '0 0 10px rgba(245,158,11,0.5)' : '0 0 10px rgba(34,197,94,0.5)'}
        />
        <GaugeBar
          value={networkHealth.platformUtil}
          color="var(--color-accent-purple)"
          label="Corridor Passenger Occupancy"
          glow="0 0 10px rgba(168,85,247,0.5)"
        />
      </div>

      {/* ── Key Metrics Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0">
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

      {/* ── Section 1: Live Train Health & Risk Assessment ── */}
      <div
        className="bg-bg-card border border-border-default rounded-lg p-3 mb-4 flex flex-col gap-2 shrink-0"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-accent-blue" />
            <span className="text-[10px] text-text-secondary font-mono font-semibold uppercase tracking-wider">
              Live Train Health & Risk Telemetry ({trains.length} Monitored)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[8px] font-mono">
            {riskCounts.critical > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-accent-red border border-red-500/20 font-bold uppercase">
                {riskCounts.critical} Critical
              </span>
            )}
            {riskCounts.high > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-accent-orange border border-orange-500/20 font-bold uppercase">
                {riskCounts.high} High
              </span>
            )}
            {riskCounts.moderate > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-accent-amber border border-amber-500/20 font-bold uppercase">
                {riskCounts.moderate} Moderate
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-accent-green border border-green-500/20 font-bold uppercase">
              {riskCounts.low} Nominal
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {trainAssessments.map(({ train, targetStation, stWeather, risk }) => {
            const isDelayed = (train.predictedDelay || 0) > 0;
            const isSevere = (train.predictedDelay || 0) >= 25;
            const delayColor = isSevere ? 'var(--color-accent-red)' : isDelayed ? 'var(--color-accent-amber)' : 'var(--color-accent-green)';
            const occupancyRate = train.capacity > 0 ? Math.round((train.passengerCount / train.capacity) * 100) : 0;
            const rc = RISK_COLOR(risk.level);

            return (
              <div
                key={train.id}
                className="bg-bg-elevated/70 border border-border-subtle hover:border-border-default rounded-lg p-2.5 flex flex-col gap-2 transition-colors"
              >
                {/* Row 1: Identification & Risk Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: TRAIN_COLORS[train.id] || '#3b82f6', boxShadow: `0 0 6px ${TRAIN_COLORS[train.id] || '#3b82f6'}80` }}
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[12px] font-mono font-bold text-text-primary">
                        {train.id}
                      </span>
                      <span className="text-[11px] font-medium text-text-secondary truncate max-w-[140px] sm:max-w-[240px]">
                        {train.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: delayColor,
                        background: `color-mix(in srgb, ${delayColor} 12%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${delayColor} 30%, transparent)`,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isDelayed ? `+${train.predictedDelay}m` : 'On Time'}
                    </span>
                    <RiskBadge level={risk.level} />
                  </div>
                </div>

                {/* Row 2: Route, Telemetry & Operational Explanation */}
                <div className="flex items-center justify-between text-[9px] font-mono text-text-tertiary flex-wrap gap-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-text-secondary uppercase">{train.currentStation.toUpperCase()}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-text-muted shrink-0" />
                    <span className="font-bold text-text-secondary uppercase">{train.nextStation.toUpperCase()}</span>
                    <span className="text-text-muted">· {train.speed} km/h</span>
                    <span className="text-text-muted">· {occupancyRate}% load</span>
                  </div>

                  <span className="text-[9px] font-mono truncate max-w-[260px] sm:max-w-[340px]" style={{ color: rc }}>
                    {risk.reason}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Station Risk & Corridor Infrastructure Summary ── */}
      <div
        className="bg-bg-card border border-border-default rounded-lg p-3 mb-4 flex flex-col gap-2 shrink-0"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-accent-green" />
            <span className="text-[10px] text-text-secondary font-mono font-semibold uppercase tracking-wider">
              Station & Corridor Infrastructure Risk ({stations.length} Monitored)
            </span>
          </div>
          <span className="text-[8px] font-mono text-text-muted uppercase tracking-wider">
            Composite Score
          </span>
        </div>

        <div className="flex flex-col gap-0 divide-y divide-border-subtle">
          {stations.map(station => {
            const risk = stationRisks[station.id] || { crowdRisk: 'low', delayRisk: 'low', platformConflicts: 0 };
            const stWeather = weatherData?.[station.id];
            const compositeRisk = getStationCompositeRisk(risk, stWeather);
            const rc = RISK_COLOR(compositeRisk);

            const maxDelayAtStation = trains
              .filter(t => t.nextStation === station.id || t.currentStation === station.id)
              .reduce((max, t) => Math.max(max, t.predictedDelay || 0), 0);

            const hasRain = stWeather && stWeather.rainfall > 0;
            const hasFog = stWeather && stWeather.visibility < 10 && !hasRain;

            return (
              <div
                key={station.id}
                className="flex items-center justify-between py-2 px-1 hover:bg-bg-elevated/50 transition-colors rounded-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: rc, boxShadow: `0 0 5px ${rc}99` }}
                  />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono text-text-primary font-bold">{station.code}</span>
                    <span className="text-[9px] text-text-tertiary truncate max-w-[110px] sm:max-w-[190px]">
                      {station.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {maxDelayAtStation > 0 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-mono font-semibold text-accent-amber bg-amber-500/10 border border-amber-500/20">
                      +{maxDelayAtStation}m incoming
                    </span>
                  )}
                  {hasRain && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-mono font-semibold text-accent-blue bg-blue-500/10 border border-blue-500/20 flex items-center gap-0.5">
                      <CloudRain className="w-2.5 h-2.5" /> {stWeather.rainfall}mm
                    </span>
                  )}
                  {hasFog && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-mono font-semibold text-text-tertiary bg-text-tertiary/10 border border-text-tertiary/20 flex items-center gap-0.5">
                      <CloudFog className="w-2.5 h-2.5" /> {stWeather.visibility}km
                    </span>
                  )}
                  {risk.platformConflicts > 0 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold text-accent-red bg-red-500/12 border border-red-500/25">
                      {risk.platformConflicts} conflicts
                    </span>
                  )}
                  <RiskBadge level={compositeRisk} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Active Subsystems Telemetry Grid ── */}
      <div
        className="bg-bg-card border border-border-default rounded-lg p-3 shrink-0 mb-3"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-[0.08em] block mb-2.5">
          Active Telemetry Subsystems & Feeds
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {systems.map(sys => (
            <div
              key={sys.label}
              className="flex items-center justify-between p-2 rounded-md border border-border-subtle bg-bg-elevated/40"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${sys.pulse ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: sys.color,
                    boxShadow: sys.active ? `0 0 6px ${sys.color}99` : undefined,
                  }}
                />
                <span className="text-[9px] text-text-secondary font-mono truncate">{sys.label}</span>
              </div>
              <span className="text-[8px] font-mono uppercase tracking-wider text-text-tertiary shrink-0 ml-1">
                {sys.detail}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto text-[9px] text-text-muted text-center font-mono uppercase tracking-wider pb-1 shrink-0">
        Live High-Density Monitoring · RailTwin Operations Center
      </div>
    </div>
  );
};
