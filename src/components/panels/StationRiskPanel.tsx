import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { RiskBadge } from '../ui/RiskBadge';
import { StatCard } from '../ui/StatCard';
import { CloudRain, CloudFog, Wind } from 'lucide-react';

interface StationCardProps {
  station: any;
  risks: {
    crowdRisk: 'low' | 'moderate' | 'high' | 'critical';
    delayRisk: 'low' | 'moderate' | 'high' | 'critical';
    platformConflicts: number;
  };
  prediction: any;
  weather: any;
}

const StationCard: React.FC<StationCardProps> = ({
  station,
  risks,
  prediction,
  weather
}) => {
  const [isFlash, setIsFlash] = useState(false);
  const prevRiskRef = useRef(risks.crowdRisk);

  const crowdRisk = risks.crowdRisk;

  // Track risk level changes to trigger a border flash
  useEffect(() => {
    if (prevRiskRef.current !== crowdRisk) {
      setIsFlash(true);
      const timer = setTimeout(() => setIsFlash(false), 600);
      prevRiskRef.current = crowdRisk;
      return () => clearTimeout(timer);
    }
  }, [crowdRisk]);

  // Determine flash border color
  let flashBorderColor = 'var(--color-border-default)';
  if (isFlash) {
    if (crowdRisk === 'moderate') flashBorderColor = 'var(--color-risk-moderate)';
    else if (crowdRisk === 'high')     flashBorderColor = 'var(--color-risk-high)';
    else if (crowdRisk === 'critical') flashBorderColor = 'var(--color-risk-critical)';
    else flashBorderColor = 'var(--color-risk-low)';
  }

  // Weather metrics check
  const hasRain = weather && weather.rainfall > 0;
  const hasFog = weather && weather.visibility < 10 && !hasRain;
  const hasWeather = hasRain || hasFog;
  const hasPrediction = !!prediction;
  const hasConflicts = risks.platformConflicts > 0;
  const hasHighCrowd = crowdRisk === 'high' || crowdRisk === 'critical';
  const hasDetails = hasPrediction || hasConflicts || hasHighCrowd || hasWeather;

  return (
    <div
      className="bg-bg-card border rounded-lg p-3 max-sm:p-2 mb-2 transition-all duration-300"
      style={{
        borderColor: isFlash ? flashBorderColor : 'var(--color-border-default)',
        boxShadow:   isFlash ? `0 0 10px ${flashBorderColor}33` : 'var(--shadow-card)',
      }}
      onMouseEnter={e => { if (!isFlash) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-hover)'; }}
      onMouseLeave={e => { if (!isFlash) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-default)'; }}
    >
      <div className="flex items-center justify-between">
        {/* Left Side: Info */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary select-none">
            {station.code}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-text-primary select-none">
              {station.name}
            </span>
            {hasRain && (
              <span title={`${weather.description} (${weather.rainfall}mm/hr)`}>
                <CloudRain className="w-3.5 h-3.5 text-accent-blue animate-pulse" />
              </span>
            )}
            {hasFog && (
              <span title={`${weather.description} (Vis: ${weather.visibility}km)`}>
                <CloudFog className="w-3.5 h-3.5 text-text-tertiary animate-pulse" />
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Risk pill */}
        <RiskBadge level={crowdRisk} />
      </div>

      {/* Bottom details row */}
      {hasDetails && (
        <div className="mt-2.5 pt-2 border-t border-border-default/50 flex flex-wrap gap-x-3 gap-y-1">
          {hasPrediction && (
            <span className="text-accent-amber font-mono text-[10px] font-semibold flex items-center gap-1 uppercase tracking-wider">
              <span>⚠</span> {prediction.trainId} +{prediction.delayMinutes}m
            </span>
          )}
          {hasConflicts && (
            <span className="text-accent-red font-mono text-[10px] font-semibold flex items-center gap-1 uppercase tracking-wider">
              <span>⚡</span> {risks.platformConflicts} conflicts
            </span>
          )}
          {hasHighCrowd && (
            <span className="text-accent-amber font-mono text-[10px] font-semibold flex items-center gap-1 uppercase tracking-wider">
              <span>👥</span> High crowd
            </span>
          )}
          {hasWeather && (
            <span className="text-accent-blue font-mono text-[10px] font-semibold flex items-center gap-1 uppercase tracking-wider">
              {hasRain ? (
                <><span>🌧</span> {weather.rainfall} mm/h</>
              ) : (
                <><span>🌫</span> {weather.visibility} km vis</>
              )}
            </span>
          )}
          {weather && weather.windSpeed > 20 && (
            <span className="text-accent-red font-mono text-[10px] font-semibold flex items-center gap-1 uppercase tracking-wider">
              <Wind className="w-3 h-3" /> {weather.windSpeed} km/h
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const StationRiskPanel: React.FC = () => {
  const loading = useDemoStore(state => state.loading);
  const stationRisks = useDemoStore(state => state.stationRisks);
  const predictions = useDemoStore(state => state.predictions);
  const weatherData = useDemoStore(state => state.weatherData);
  const trains = useDemoStore(state => state.trains);
  const stations = useDemoStore(state => state.stations) || [];
  const simulation = useDemoStore(state => state.simulation);

  // Compute live dot state
  const hasCriticalStation = Object.values(stationRisks).some(
    r => r.crowdRisk === 'critical' || r.delayRisk === 'critical'
  );

  // Stats Card Calculations
  const activeTrainsCount = trains.length;
  const stationsCount = stations.length;
  const totalPredictedDelay = trains.reduce((acc, t) => acc + (t.predictedDelay || 0), 0);
  const passengersAtRisk = simulation?.passengersAffected || 0;

  // Format passengers count
  const formattedPassengers = passengersAtRisk >= 1000
    ? `${(passengersAtRisk / 1000).toFixed(0)}K`
    : passengersAtRisk.toString();

  if (loading && stations.length === 0) {
    return (
      <div className="flex flex-col h-full bg-bg-page text-text-primary items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-[10px] font-mono text-text-muted">Loading station data...</span>
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="flex flex-col h-full bg-bg-page text-text-primary items-center justify-center py-12">
        <span className="text-[10px] font-mono text-text-muted">No station data available</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary">
      {/* 2x2 Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4 max-sm:gap-1.5 max-sm:mb-3">
        <StatCard
          label="Active Trains"
          value={activeTrainsCount}
          color="#3b82f6"
        />
        <StatCard
          label="Stations"
          value={stationsCount}
          color="#22c55e"
        />
        <StatCard
          label="Est. Delays"
          value={totalPredictedDelay}
          unit="min"
          color={totalPredictedDelay > 0 ? '#f59e0b' : '#ffffff'}
        />
        <StatCard
          label="Passengers"
          value={formattedPassengers}
          color={passengersAtRisk > 0 ? '#ef4444' : '#ffffff'}
        />
      </div>

      {/* Header with Live Dot */}
      <div className="flex items-center justify-between border-b border-border-default pb-2 mb-3 max-sm:pb-1.5 max-sm:mb-2">
        <span className="text-xs uppercase tracking-[0.12em] text-text-tertiary font-medium select-none max-sm:text-[10px]">
          Live Stations Status
        </span>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: hasCriticalStation ? 'var(--color-accent-red)' : 'var(--color-accent-green)' }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: hasCriticalStation ? 'var(--color-accent-red)' : 'var(--color-accent-green)', boxShadow: hasCriticalStation ? 'var(--glow-red)' : 'var(--glow-green)' }}
            />
          </span>
          <span className="text-[10px] text-text-secondary font-mono select-none font-bold uppercase tracking-wider" style={{ color: hasCriticalStation ? 'var(--color-accent-red)' : 'var(--color-accent-green)' }}>
            {hasCriticalStation ? 'CRITICAL RISK' : 'NOMINAL'}
          </span>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 scrollbar-thin">
        {stations.map(station => {
          const risks = stationRisks[station.id] || {
            crowdRisk: 'low',
            delayRisk: 'low',
            platformConflicts: 0
          };
          // Find if there is a prediction for a train arriving here
          const prediction = predictions.find(p => p.affectedStation === station.id);

          return (
            <StationCard
              key={station.id}
              station={station}
              risks={risks}
              prediction={prediction}
              weather={weatherData ? weatherData[station.id] : null}
            />
          );
        })}
      </div>
    </div>
  );
};
