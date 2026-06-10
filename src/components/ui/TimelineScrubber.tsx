import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Play, Pause, RotateCcw, FastForward, SkipForward } from 'lucide-react';

export const TimelineScrubber: React.FC = () => {
  const demoTime = useDemoStore(state => state.demoTime);
  const demoRunning = useDemoStore(state => state.demoRunning);
  const isPaused = useDemoStore(state => state.isPaused);
  const playbackSpeed = useDemoStore(state => state.playbackSpeed);
  const pauseDemo = useDemoStore(state => state.pauseDemo);
  const resumeDemo = useDemoStore(state => state.resumeDemo);
  const seekTo = useDemoStore(state => state.seekTo);
  const setPlaybackSpeed = useDemoStore(state => state.setPlaybackSpeed);
  const startDemo = useDemoStore(state => state.startDemo);
  const resetDemo = useDemoStore(state => state.resetDemo);

  const maxTime = 50;
  const progress = (demoTime / maxTime) * 100;

  // Event markers on the timeline
  const eventMarkers = [
    { time: 0, label: 'Weather', color: '#f59e0b' },
    { time: 4, label: 'Prediction', color: '#f97316' },
    { time: 8, label: 'Prediction', color: '#f97316' },
    { time: 12, label: 'Simulation', color: '#ef4444' },
    { time: 18, label: 'Copilot', color: '#a855f7' },
    { time: 24, label: 'Recommendations', color: '#a855f7' },
    { time: 36, label: 'Intervention', color: '#3b82f6' },
    { time: 42, label: 'Resolved', color: '#22c55e' },
  ];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseInt(e.target.value));
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider">Timeline Control</span>
        <span className="text-[10px] text-[#3b82f6] font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(demoTime)} / {formatTime(maxTime)}
        </span>
      </div>

      {/* Timeline Slider with Event Markers */}
      <div className="relative mb-3">
        {/* Event marker dots */}
        <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none z-10">
          {eventMarkers.map(marker => (
            <div
              key={marker.time}
              className="absolute top-0 w-1.5 h-1.5 rounded-full -translate-x-1/2"
              style={{
                left: `${(marker.time / maxTime) * 100}%`,
                backgroundColor: marker.color,
                opacity: demoTime >= marker.time ? 1 : 0.3
              }}
              title={marker.label}
            />
          ))}
        </div>

        {/* Slider track */}
        <input
          type="range"
          min={0}
          max={maxTime}
          value={demoTime}
          onChange={handleSliderChange}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer mt-1"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${progress}%, #222222 ${progress}%)`,
            accentColor: '#3b82f6'
          }}
        />
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Play/Pause */}
          {!demoRunning ? (
            <button
              onClick={startDemo}
              className="flex items-center gap-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors outline-none"
            >
              <Play className="w-3 h-3" />
              <span>Play</span>
            </button>
          ) : isPaused ? (
            <button
              onClick={resumeDemo}
              className="flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-white text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors outline-none"
            >
              <Play className="w-3 h-3" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              onClick={pauseDemo}
              className="flex items-center gap-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors outline-none"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
          )}

          {/* Reset */}
          <button
            onClick={resetDemo}
            className="flex items-center gap-1 bg-[#1a1a1a] border border-[#333] hover:border-[#555] text-[#888] hover:text-white text-[10px] font-mono px-2 py-1 rounded-md transition-colors outline-none"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Skip to end */}
          <button
            onClick={() => seekTo(maxTime)}
            className="flex items-center gap-1 bg-[#1a1a1a] border border-[#333] hover:border-[#555] text-[#888] hover:text-white text-[10px] font-mono px-2 py-1 rounded-md transition-colors outline-none"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1">
          <FastForward className="w-3 h-3 text-[#555]" />
          {[1, 2, 4].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors outline-none ${
                playbackSpeed === speed
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#1a1a1a] border border-[#333] text-[#555] hover:text-white hover:border-[#555]'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Event Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-border-default">
        {eventMarkers.filter((m, i, arr) => arr.findIndex(x => x.label === m.label) === i).map(marker => (
          <div key={marker.label} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: marker.color }} />
            <span className="text-[8px] text-[#555] font-mono">{marker.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
