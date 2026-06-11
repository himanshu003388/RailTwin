import React, { useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Train, Play } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export const DelayChart: React.FC = () => {
  const trains      = useDemoStore(state => state.trains);
  const predictions = useDemoStore(state => state.predictions);
  const startDemo   = useDemoStore(state => state.startDemo);
  const demoRunning = useDemoStore(state => state.demoRunning);
  const stations    = useDemoStore(state => state.stations) || [];

  const [selectedTrainId, setSelectedTrainId] = useState('12301');
  const [expandedPredId, setExpandedPredId] = useState<string | null>(null);

  const sortedStations = [...stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);

  const getChartData = () => {
    const selectedTrain = trains.find(t => t.id === selectedTrainId);
    if (!selectedTrain) return [];
    const trainPredictions = predictions.filter(p => p.trainId === selectedTrainId);
    return sortedStations.map(station => {
      const directPred = trainPredictions.find(p => p.affectedStation === station.id);
      let delay = 0, confidence = 1.0;
      if (directPred) {
        delay = directPred.delayMinutes;
        confidence = directPred.confidence;
      } else {
        const earlierPred = trainPredictions.find(p => {
          const predStation = stations.find(s => s.id === p.affectedStation);
          return predStation && predStation.kmFromOrigin <= station.kmFromOrigin;
        });
        if (earlierPred) { delay = earlierPred.delayMinutes; confidence = earlierPred.confidence; }
      }
      return { name: station.code, fullName: station.name, scheduled: 0, predicted: delay, confidence: Math.round(confidence * 100) };
    });
  };

  const chartData = getChartData();
  const maxDelay = Math.max(...chartData.map(d => d.predicted), 0);
  let gradientColor = '#3b82f6';
  let gradientId    = 'delayGradientBlue';
  if (maxDelay > 35)      { gradientColor = '#ef4444'; gradientId = 'delayGradientRed'; }
  else if (maxDelay > 20) { gradientColor = '#f59e0b'; gradientId = 'delayGradientAmber'; }

  const activePredsList = predictions.map(pred => ({
    ...pred,
    trainName:   trains.find(t => t.id === pred.trainId)?.name ?? `Train ${pred.trainId}`,
    stationName: stations.find(s => s.id === pred.affectedStation)?.name ?? pred.affectedStation,
  }));

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary select-none">
      {predictions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-border-default border-dashed rounded-xl py-12 px-6 text-center">
          <Train className="w-10 h-10 text-border-default mb-3" />
          <span className="text-sm text-text-secondary font-medium mb-1">No predictions yet</span>
          <span className="text-xs text-text-tertiary mb-4 max-w-[260px] leading-relaxed">
            Run the demo scenario to see real-time delay predictions and corridor warnings
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
      ) : (
        <>
          {/* Train Selector Tabs */}
          <div className="flex border-b border-border-default mb-4 overflow-x-auto scrollbar-none">
            {trains.map(train => {
              const isActive = selectedTrainId === train.id;
              const hasDelay = train.predictedDelay > 0;
              const dotColor = train.predictedDelay > 30 ? 'var(--color-accent-red)' : train.predictedDelay > 0 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)';
              return (
                <button
                  key={train.id}
                  onClick={() => setSelectedTrainId(train.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-b-2 outline-none whitespace-nowrap transition-all duration-150"
                  style={{
                    background:   isActive ? 'var(--color-bg-elevated)' : 'transparent',
                    color:        isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    borderColor:  isActive ? 'var(--color-accent-blue)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; } }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
                >
                  <span>{train.id}</span>
                  {hasDelay && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dotColor }} />}
                </button>
              );
            })}
          </div>

          {/* Area Chart */}
          <div
            className="flex-1 w-full h-[220px] rounded-xl p-3 mb-4 border border-border-default"
            style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-card)' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="delayGradientBlue"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="delayGradientAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="delayGradientRed"   x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} stroke="#1e1e1e" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4a4a4a', fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis domain={[0, 60]} axisLine={false} tickLine={false} tick={{ fill: '#4a4a4a', fontSize: 10, fontFamily: 'monospace' }} />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div
                          className="font-mono text-[10px] shadow-xl"
                          style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-hover)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-text-primary)' }}
                        >
                          <div className="font-bold mb-1" style={{ color: 'var(--color-accent-blue)' }}>{data.fullName}</div>
                          <div>Scheduled: <span style={{ color: 'var(--color-text-secondary)' }}>0 min</span></div>
                          <div>Predicted: <span style={{ color: gradientColor, fontWeight: 700 }}>{data.predicted} min</span></div>
                          <div>Confidence: <span style={{ color: 'var(--color-text-secondary)' }}>{data.confidence}%</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="scheduled" stroke="#2e2e2e" strokeWidth={1} strokeDasharray="4 2" fill="none" activeDot={false} />
                <Area type="monotone" dataKey="predicted"  stroke={gradientColor} strokeWidth={2} fill={`url(#${gradientId})`} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Active Predictions List */}
          <div className="flex flex-col flex-1 min-h-[140px] max-h-[220px]">
            <h3 className="text-[10px] uppercase tracking-[0.12em] text-text-tertiary font-mono font-medium mb-2 border-b border-border-default pb-1.5">
              Active Corridor Warnings ({predictions.length})
            </h3>
            <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-2 scrollbar-thin">
              {activePredsList.map((pred, idx) => {
                const predId = `${pred.trainId}-${pred.affectedStation}-${idx}`;
                const isExpanded = expandedPredId === predId;
                const sevColor = pred.delayMinutes > 30 ? 'var(--color-accent-red)' : pred.delayMinutes >= 10 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)';
                
                return (
                  <div
                    key={predId}
                    onClick={() => setExpandedPredId(isExpanded ? null : predId)}
                    className="rounded-lg p-2.5 flex flex-col gap-1.5 transition-all duration-200 cursor-pointer animate-prediction-row"
                    style={{
                      background: 'var(--color-bg-card)',
                      border: isExpanded ? '1px solid var(--color-border-active)' : '1px solid var(--color-border-default)',
                      boxShadow: isExpanded ? 'var(--shadow-card-elevated)' : 'var(--shadow-card)'
                    }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-hover)'; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-default)'; }}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-primary font-semibold">{pred.trainId}</span>
                        <span className="text-text-muted">→</span>
                        <span className="font-mono uppercase tracking-widest text-text-tertiary">{pred.affectedStation}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: sevColor, fontVariantNumeric: 'tabular-nums' }}>+{pred.delayMinutes} min</span>
                        <span className="text-text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>({Math.round(pred.confidence * 100)}%)</span>
                      </div>
                    </div>
                    
                    <div className="w-full h-[3px] rounded overflow-hidden mb-0.5" style={{ background: 'var(--color-bg-sunken)' }}>
                      <div
                        className="h-full transition-all duration-500 rounded"
                        style={{ width: `${pred.confidence * 100}%`, background: sevColor, boxShadow: `0 0 4px ${sevColor}` }}
                      />
                    </div>

                    {isExpanded && pred.explanation && (
                      <div 
                        className="mt-2 p-2.5 rounded border text-text-secondary font-mono text-[9px] leading-relaxed whitespace-pre-wrap select-text animate-slide-down bg-[#141414] border-[#2a2a2a] text-[#8eecf5]"
                        onClick={e => e.stopPropagation()}
                      >
                        {pred.explanation}
                      </div>
                    )}

                    {!isExpanded && (
                      <span className="text-[8px] text-text-muted self-end font-mono uppercase tracking-wider select-none">
                        Click to explain prediction
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
