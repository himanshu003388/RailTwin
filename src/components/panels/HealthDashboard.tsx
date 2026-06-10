import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CORRIDOR } from '../../data/corridor';
import { Activity, Train, Clock, Users, Gauge, AlertTriangle, Shield } from 'lucide-react';

const GaugeBar: React.FC<{ value: number; max?: number; color: string; label: string }> = ({
  value, max = 100, color, label
}) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[#555] font-mono uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full bg-[#1a1a1a] h-1.5 rounded-full overflow-hidden border border-[#222222]/50">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

export const HealthDashboard: React.FC = () => {
  const networkHealth = useDemoStore(state => state.networkHealth);
  const trains = useDemoStore(state => state.trains);
  const stationRisks = useDemoStore(state => state.stationRisks);
  const simulation = useDemoStore(state => state.simulation);
  const weatherAlert = useDemoStore(state => state.weatherAlert);
  const predictions = useDemoStore(state => state.predictions);
  const resolved = useDemoStore(state => state.resolved);

  const totalPassengers = trains.reduce((sum, t) => sum + t.passengerCount, 0);
  const totalCapacity = trains.reduce((sum, t) => sum + t.capacity, 0);
  const avgSpeed = trains.length > 0
    ? Math.round(trains.reduce((sum, t) => sum + t.speed, 0) / trains.length)
    : 0;
  const criticalStations = Object.values(stationRisks).filter(
    r => r.crowdRisk === 'critical' || r.delayRisk === 'critical'
  ).length;
  const highRiskStations = Object.values(stationRisks).filter(
    r => r.crowdRisk === 'high' || r.delayRisk === 'high'
  ).length;

  const statusColor = networkHealth.signalStatus === 'operational'
    ? '#22c55e'
    : networkHealth.signalStatus === 'degraded'
    ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#222222] pb-2.5 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#22c55e]" />
          <h2 className="text-xs uppercase tracking-[0.12em] text-[#555] font-medium">
            System Health Dashboard
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
          <span className="text-[10px] font-mono font-bold uppercase" style={{ color: statusColor }}>
            {networkHealth.signalStatus}
          </span>
        </div>
      </div>

      {/* Network Gauges */}
      <div className="grid grid-cols-1 gap-3 mb-5">
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-3">
          <GaugeBar value={networkHealth.efficiency} color="#3b82f6" label="Network Efficiency" />
        </div>
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-3">
          <GaugeBar value={networkHealth.onTimePerf} color="#22c55e" label="On-Time Performance" />
        </div>
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-3">
          <GaugeBar value={networkHealth.platformUtil} color="#a855f7" label="Platform Utilization" />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-2.5 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <Train className="w-3 h-3 text-[#3b82f6]" />
            <span className="text-[9px] text-[#555] font-mono uppercase">Active Trains</span>
          </div>
          <span className="text-lg font-mono font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {trains.length}
          </span>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-lg p-2.5 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3 h-3 text-[#a855f7]" />
            <span className="text-[9px] text-[#555] font-mono uppercase">Passengers</span>
          </div>
          <span className="text-lg font-mono font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {(totalPassengers / 1000).toFixed(1)}K
          </span>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-lg p-2.5 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <Gauge className="w-3 h-3 text-[#f59e0b]" />
            <span className="text-[9px] text-[#555] font-mono uppercase">Avg Speed</span>
          </div>
          <span className="text-lg font-mono font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {avgSpeed} <span className="text-xs text-[#555]">km/h</span>
          </span>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-lg p-2.5 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3 text-[#ef4444]" />
            <span className="text-[9px] text-[#555] font-mono uppercase">Alerts</span>
          </div>
          <span className="text-lg font-mono font-bold" style={{ color: networkHealth.activeAlerts > 0 ? '#ef4444' : '#22c55e', fontVariantNumeric: 'tabular-nums' }}>
            {networkHealth.activeAlerts}
          </span>
        </div>
      </div>

      {/* Station Risk Summary */}
      <div className="bg-[#111111] border border-[#222222] rounded-lg p-3 mb-4">
        <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider block mb-2">
          Station Risk Summary
        </span>
        <div className="flex flex-col gap-1.5">
          {CORRIDOR.stations.map(station => {
            const risk = stationRisks[station.id];
            const riskColor = risk.crowdRisk === 'critical' ? '#ef4444'
              : risk.crowdRisk === 'high' ? '#f97316'
              : risk.crowdRisk === 'moderate' ? '#f59e0b'
              : '#22c55e';
            return (
              <div key={station.id} className="flex items-center justify-between py-1 border-b border-[#222222]/30 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskColor }} />
                  <span className="text-[10px] font-mono text-white">{station.code}</span>
                  <span className="text-[9px] text-[#555]">{station.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {risk.platformConflicts > 0 && (
                    <span className="text-[8px] bg-[#ef4444]/20 text-[#ef4444] px-1 rounded font-mono">
                      {risk.platformConflicts} conflicts
                    </span>
                  )}
                  <span className="text-[9px] font-mono uppercase" style={{ color: riskColor }}>
                    {risk.crowdRisk}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Systems Status */}
      <div className="bg-[#111111] border border-[#222222] rounded-lg p-3">
        <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider block mb-2">
          Active Systems
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${weatherAlert ? 'bg-[#f59e0b] animate-pulse' : 'bg-[#22c55e]'}`} />
            <span className="text-[9px] text-[#888] font-mono">Weather Monitor</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${simulation ? 'bg-[#f59e0b] animate-pulse' : 'bg-[#22c55e]'}`} />
            <span className="text-[9px] text-[#888] font-mono">Cascade Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span className="text-[9px] text-[#888] font-mono">Signal Control</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span className="text-[9px] text-[#888] font-mono">AI Copilot</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${predictions.length > 0 ? 'bg-[#f59e0b] animate-pulse' : 'bg-[#22c55e]'}`} />
            <span className="text-[9px] text-[#888] font-mono">Prediction Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${resolved ? 'bg-[#22c55e]' : 'bg-[#555]'}`} />
            <span className="text-[9px] text-[#888] font-mono">Resolution Active</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-[9px] text-[#333] text-center font-mono uppercase tracking-wider">
        System Health · Real-Time Monitoring
      </div>
    </div>
  );
};
