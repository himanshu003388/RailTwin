import React, { useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CORRIDOR } from '../../data/corridor';
import { Train } from 'lucide-react';
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
  const trains = useDemoStore(state => state.trains);
  const predictions = useDemoStore(state => state.predictions);

  // Selector for currently active train in chart view (defaults to the first train)
  const [selectedTrainId, setSelectedTrainId] = useState('12301');

  // Sorted stations along the corridor
  const sortedStations = [...CORRIDOR.stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);

  // Compute data for Recharts AreaChart
  const getChartData = () => {
    const selectedTrain = trains.find(t => t.id === selectedTrainId);
    if (!selectedTrain) return [];

    // Filter predictions for this specific train
    const trainPredictions = predictions.filter(p => p.trainId === selectedTrainId);

    return sortedStations.map(station => {
      // Find direct prediction if matching
      const directPred = trainPredictions.find(p => p.affectedStation === station.id);

      let delay = 0;
      let confidence = 1.0;

      if (directPred) {
        delay = directPred.delayMinutes;
        confidence = directPred.confidence;
      } else {
        // If there's an earlier prediction for this train along the corridor, carry it forward
        const earlierPred = trainPredictions.find(p => {
          const predStation = CORRIDOR.stations.find(s => s.id === p.affectedStation);
          return predStation && predStation.kmFromOrigin <= station.kmFromOrigin;
        });
        if (earlierPred) {
          delay = earlierPred.delayMinutes;
          confidence = earlierPred.confidence;
        }
      }

      return {
        name: station.code, // Abbreviation e.g. "NDLS"
        fullName: station.name,
        scheduled: 0,
        predicted: delay,
        confidence: Math.round(confidence * 100)
      };
    });
  };

  const chartData = getChartData();

  // Find max delay in chart to dynamically select color thresholds
  const maxDelay = Math.max(...chartData.map(d => d.predicted), 0);
  let gradientColor = '#3b82f6'; // Default Accent Blue
  let gradientId = 'delayGradientBlue';
  if (maxDelay > 35) {
    gradientColor = '#ef4444'; // Red
    gradientId = 'delayGradientRed';
  } else if (maxDelay > 20) {
    gradientColor = '#f59e0b'; // Amber
    gradientId = 'delayGradientAmber';
  }

  // Handle active predictions display list
  const activePredsList = predictions.map(pred => {
    const train = trains.find(t => t.id === pred.trainId);
    const station = CORRIDOR.stations.find(s => s.id === pred.affectedStation);
    return {
      ...pred,
      trainName: train ? train.name : `Train ${pred.trainId}`,
      stationName: station ? station.name : pred.affectedStation
    };
  });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white select-none">
      {/* Dynamic Keyframe Animations for predictions row lists */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes prediction-slide-in {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-prediction-row {
          animation: prediction-slide-in 0.3s ease-out forwards;
        }
      ` }} />

      {predictions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-[#222222] border-dashed rounded-xl py-12 px-4 text-center text-[#555] font-mono text-xs select-none">
          <Train className="w-8 h-8 text-[#222] mb-3 animate-pulse" />
          <span>Awaiting predictions — run demo to activate</span>
        </div>
      ) : (
        <>
          {/* Train Selector Tabs */}
          <div className="flex border-b border-[#222222] mb-4 overflow-x-auto scrollbar-none">
            {trains.map(train => {
              const isActive = selectedTrainId === train.id;
              const hasDelay = train.predictedDelay > 0;
              let dotColor = 'bg-[#22c55e]'; // Safe/green
              if (train.predictedDelay > 30) dotColor = 'bg-[#ef4444]'; // Red
              else if (train.predictedDelay > 0) dotColor = 'bg-[#f59e0b]'; // Amber

              return (
                <button
                  key={train.id}
                  onClick={() => setSelectedTrainId(train.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-b-2 outline-none whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'bg-[#1a1a1a] text-white border-[#3b82f6]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[#111111] border-transparent'
                  }`}
                >
                  <span>{train.id}</span>
                  {hasDelay && (
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${dotColor}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Recharts AreaChart Area */}
          <div className="flex-1 w-full h-[220px] bg-[#111111] border border-[#222222] rounded-xl p-3 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="delayGradientBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="delayGradientAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="delayGradientRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} stroke="#222" />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#555555', fontSize: 10, fontFamily: 'monospace' }}
                />

                <YAxis
                  domain={[0, 60]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#555555', fontSize: 10, fontFamily: 'monospace' }}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-2.5 font-mono text-[10px] text-white shadow-xl">
                          <div className="font-bold text-[#3b82f6] mb-1">{data.fullName}</div>
                          <div>Scheduled Delay: <span className="text-text-secondary">0 min</span></div>
                          <div>Predicted Delay: <span style={{ color: gradientColor }} className="font-bold">{data.predicted} min</span></div>
                          <div>Confidence: <span className="text-text-secondary">{data.confidence}%</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Scheduled reference line */}
                <Area
                  type="monotone"
                  dataKey="scheduled"
                  stroke="#333333"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  fill="none"
                  activeDot={false}
                />

                {/* Predicted area plot */}
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke={gradientColor}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Active Predictions List */}
          <div className="flex flex-col flex-1 min-h-[140px] max-h-[220px]">
            <h3 className="text-xs uppercase tracking-[0.12em] text-[#555] font-medium mb-2 border-b border-[#222222] pb-1.5">
              Active Corridor Warnings ({predictions.length})
            </h3>

            <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-2 scrollbar-thin">
              {activePredsList.map((pred, idx) => {
                // Color delay based on severity
                let severityColor = 'text-[#22c55e]'; // safe
                if (pred.delayMinutes > 30) severityColor = 'text-[#ef4444]'; // red
                else if (pred.delayMinutes >= 10) severityColor = 'text-[#f59e0b]'; // amber

                return (
                  <div
                    key={`${pred.trainId}-${pred.affectedStation}-${idx}`}
                    className="bg-[#111111] border border-[#222222] rounded-lg p-2.5 flex flex-col gap-1.5 hover:border-[#333333] transition-colors duration-150 animate-prediction-row"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-semibold">{pred.trainId}</span>
                        <span className="text-[#555]">→</span>
                        <span className="font-mono uppercase tracking-widest text-[#555]">{pred.affectedStation}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`${severityColor} font-bold font-mono`} style={{ fontVariantNumeric: 'tabular-nums' }}>+{pred.delayMinutes} min</span>
                        <span className="text-[#555]" style={{ fontVariantNumeric: 'tabular-nums' }}>({Math.round(pred.confidence * 100)}% conf)</span>
                      </div>
                    </div>

                    {/* Confidence progress bar */}
                    <div className="w-full bg-[#1a1a1a] h-1 rounded overflow-hidden">
                      <div
                        className="bg-[#3b82f6] h-full transition-all duration-500"
                        style={{ width: `${pred.confidence * 100}%` }}
                      />
                    </div>
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
