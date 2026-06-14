import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Play, Pause, RotateCcw, FastForward, SkipForward } from 'lucide-react';

export const TimelineScrubber: React.FC = () => {
  const demoTime      = useDemoStore(state => state.demoTime);
  const demoRunning   = useDemoStore(state => state.demoRunning);
  const isPaused      = useDemoStore(state => state.isPaused);
  const playbackSpeed = useDemoStore(state => state.playbackSpeed);
  const pauseDemo     = useDemoStore(state => state.pauseDemo);
  const resumeDemo    = useDemoStore(state => state.resumeDemo);
  const seekTo        = useDemoStore(state => state.seekTo);
  const setPlaybackSpeed = useDemoStore(state => state.setPlaybackSpeed);
  const startDemo     = useDemoStore(state => state.startDemo);
  const resetDemo     = useDemoStore(state => state.resetDemo);

  const maxTime  = 50;
  const progress = (demoTime / maxTime) * 100;

  const eventMarkers = [
    { time:  0, label: 'Weather',         color: 'var(--color-accent-amber)' },
    { time:  4, label: 'Prediction',      color: 'var(--color-accent-red)'   },
    { time:  8, label: 'Prediction',      color: 'var(--color-accent-red)'   },
    { time: 12, label: 'Simulation',      color: 'var(--color-accent-red)'   },
    { time: 18, label: 'AI Chat',         color: 'var(--color-accent-purple)'},
    { time: 24, label: 'Recommendations', color: 'var(--color-accent-purple)'},
    { time: 36, label: 'Intervention',    color: 'var(--color-accent-blue)'  },
    { time: 42, label: 'Resolved',        color: 'var(--color-accent-green)' },
  ];

  const uniqueMarkers = eventMarkers.filter(
    (m, i, arr) => arr.findIndex(x => x.label === m.label) === i
  );

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    seekTo(parseInt(e.target.value));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const ctrlBtnBase = 'flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded-md transition-all duration-150 outline-none active:scale-95';
  const iconBtnBase = 'w-6 h-6 flex items-center justify-center rounded-md transition-all duration-150 outline-none active:scale-95 border';

  return (
    <div
      className="bg-bg-card border border-border-default rounded-lg p-3 select-none"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-[0.1em]">
          Timeline
        </span>
        <span
          className="text-[10px] text-accent-blue font-mono font-semibold"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatTime(demoTime)} / {formatTime(maxTime)}
        </span>
      </div>

      {/* ── Slider + Event Markers ── */}
      <div className="relative mb-3">
        {/* Marker dots above the track */}
        <div className="absolute inset-x-0 top-0 h-3 pointer-events-none z-10">
          {eventMarkers.map(marker => (
            <div
              key={`${marker.time}-${marker.label}`}
              className="absolute top-1 w-2 h-2 rounded-full -translate-x-1/2 transition-opacity duration-300 ring-1 ring-bg-page"
              style={{
                left:            `${(marker.time / maxTime) * 100}%`,
                backgroundColor: marker.color,
                opacity:         demoTime >= marker.time ? 1 : 0.25,
                boxShadow:       demoTime >= marker.time ? `0 0 6px ${marker.color}` : undefined,
              }}
              title={marker.label}
            />
          ))}
        </div>

        {/* Range track */}
        <input
          type="range"
          min={0}
          max={maxTime}
          value={demoTime}
          onChange={handleSliderChange}
          className="w-full rounded-full appearance-none cursor-pointer mt-3"
          style={{
            background: `linear-gradient(to right, var(--color-accent-blue) ${progress}%, var(--color-bg-sunken) ${progress}%)`,
            height: '5px',
          }}
        />
      </div>

      {/* ── Playback Controls ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Play / Pause / Resume */}
          {!demoRunning ? (
            <button
              onClick={startDemo}
              className={`${ctrlBtnBase} bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20`}
              style={{ boxShadow: '0 0 10px rgba(59,130,246,0.15)' }}
            >
              <Play className="w-3 h-3" />
              Play
            </button>
          ) : isPaused ? (
            <button
              onClick={resumeDemo}
              className={`${ctrlBtnBase} bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green/20`}
            >
              <Play className="w-3 h-3" />
              Resume
            </button>
          ) : (
            <button
              onClick={pauseDemo}
              className={`${ctrlBtnBase} bg-accent-amber/10 border border-accent-amber/30 text-accent-amber hover:bg-accent-amber/20`}
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
          )}

          {/* Reset */}
          <button
            onClick={resetDemo}
            className={`${iconBtnBase} bg-bg-sunken border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default`}
            title="Reset"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Skip to end */}
          <button
            onClick={() => seekTo(maxTime)}
            className={`${iconBtnBase} bg-bg-sunken border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default`}
            title="Skip to end"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1">
          <FastForward className="w-3 h-3 text-text-muted mr-0.5" />
          {[1, 2, 4].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-all duration-150 outline-none active:scale-95 ${
                playbackSpeed === speed
                  ? 'bg-accent-blue text-white shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                  : 'bg-bg-sunken border border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default'
              }`}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>

      {/* ── Event Legend ── */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 pt-2.5 border-t border-border-subtle">
        {uniqueMarkers.map(marker => (
          <div key={marker.label} className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: marker.color }}
            />
            <span className="text-[9px] text-text-tertiary font-mono">{marker.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
