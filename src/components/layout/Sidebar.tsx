import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Train, MapPin, Clock, Zap, Bot, TestTube, Activity, RotateCcw, Play, Pause } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const activePanel = useDemoStore(state => state.activePanel);
  const demoRunning = useDemoStore(state => state.demoRunning);
  const demoTime = useDemoStore(state => state.demoTime);
  const isPaused = useDemoStore(state => state.isPaused);
  const startDemo = useDemoStore(state => state.startDemo);
  const resetDemo = useDemoStore(state => state.resetDemo);
  const pauseDemo = useDemoStore(state => state.pauseDemo);
  const resumeDemo = useDemoStore(state => state.resumeDemo);
  const setActivePanel = useDemoStore(state => state.setActivePanel);
  const mobileLeftOpen = useDemoStore(state => state.mobileLeftOpen);
  const setMobileLeftOpen = useDemoStore(state => state.setMobileLeftOpen);

  const [showComplete, setShowComplete] = React.useState(false);

  React.useEffect(() => {
    if (demoTime === 50 && !demoRunning) {
      setShowComplete(true);
      const timer = setTimeout(() => { setShowComplete(false); }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowComplete(false);
    }
  }, [demoTime, demoRunning]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const getButtonProps = () => {
    if (demoRunning && !isPaused) {
      return {
        className: 'bg-bg-elevated border border-border-hover text-text-primary hover:bg-bg-hover',
        icon: <Pause className="w-3.5 h-3.5" />,
        text: `Pause  ${formatTime(demoTime)}`,
        onClick: pauseDemo,
      };
    }
    if (demoRunning && isPaused) {
      return {
        className: 'bg-accent-blue/10 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/20 shadow-[0_0_16px_rgba(59,130,246,0.2)]',
        icon: <Play className="w-3.5 h-3.5" />,
        text: `Resume  ${formatTime(demoTime)}`,
        onClick: resumeDemo,
      };
    }
    if (demoTime === 50) {
      if (showComplete) {
        return {
          className: 'bg-accent-green/10 border border-accent-green/40 text-accent-green shadow-[0_0_12px_rgba(34,197,94,0.2)]',
          icon: null,
          text: '✓ Demo Complete',
          onClick: resetDemo,
        };
      }
      return {
        className: 'bg-bg-elevated border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover',
        icon: <RotateCcw className="w-3.5 h-3.5" />,
        text: 'Reset Demo',
        onClick: resetDemo,
      };
    }
    return {
      className: 'bg-accent-blue border border-accent-blue/30 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:shadow-[0_0_24px_rgba(59,130,246,0.5)]',
      icon: <Play className="w-3.5 h-3.5" />,
      text: 'Run Demo Scenario',
      onClick: startDemo,
    };
  };

  const buttonProps = getButtonProps();

  const navItems = [
    { id: 'map'        as const, label: 'Map View',      icon: MapPin   },
    { id: 'delays'     as const, label: 'Train Delays',  icon: Clock    },
    { id: 'simulation' as const, label: 'Simulation',    icon: Zap      },
    { id: 'copilot'    as const, label: 'AI Chat',       icon: Bot      },
    { id: 'whatif'     as const, label: 'What-If Lab',   icon: TestTube },
    { id: 'health'     as const, label: 'System Health', icon: Activity },
  ];

  const progressPct = (demoTime / 50) * 100;
  const progressColor = demoTime === 50 && !demoRunning
    ? 'var(--color-accent-green)'
    : isPaused
    ? 'var(--color-accent-amber)'
    : 'var(--color-accent-blue)';

  return (
    <>
      {mobileLeftOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden cursor-pointer"
          onClick={() => setMobileLeftOpen(false)}
        />
      )}
      <aside className={`w-[240px] sidebar-left h-dvh bg-bg-card border-r border-border-default flex flex-col justify-between select-none shrink-0 transition-transform duration-300 ease-in-out max-lg:fixed max-lg:top-0 max-lg:bottom-0 max-lg:left-0 max-lg:z-50 max-sm:w-full max-sm:max-w-[280px] sidebar-accent ${
        mobileLeftOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
      }`}>
        {/* ── Brand Header ── */}
        <div className="flex flex-col gap-5 p-4">
          <div className="flex items-center gap-2.5 pt-1">
            {/* Logo Icon with glow ring */}
            <div
              className="w-8 h-8 rounded-lg bg-bg-elevated border border-border-default flex items-center justify-center text-accent-blue shrink-0 transition-all duration-300"
              style={{ boxShadow: '0 0 0 3px rgba(59,130,246,0.08), 0 0 12px rgba(59,130,246,0.2)' }}
            >
              <Train className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-sans font-semibold text-text-primary tracking-tight text-[15px] leading-tight">
                RailTwin
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-accent-purple/10 text-accent-purple border border-accent-purple/20 uppercase tracking-wider leading-none">
                AI
              </span>
            </div>
          </div>

          {/* ── Navigation ── */}
          <nav className="flex flex-col gap-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  className={`relative flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-md transition-all duration-150 text-left outline-none overflow-hidden ${
                    isActive
                      ? 'bg-bg-elevated text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60'
                  }`}
                >
                  {/* Active left accent bar */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                      style={{
                        height: '60%',
                        background: 'linear-gradient(180deg, var(--color-accent-blue), rgba(59,130,246,0.4))',
                        boxShadow: '0 0 8px rgba(59,130,246,0.6)',
                      }}
                    />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 transition-colors duration-150 ${isActive ? 'text-accent-blue' : 'text-text-tertiary'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Bottom Controls ── */}
        <div
          className="p-4 flex flex-col gap-3 border-t border-border-default"
          style={{ background: 'linear-gradient(180deg, var(--color-bg-card) 0%, var(--color-bg-sunken) 100%)' }}
        >
          <div className="flex flex-col gap-1.5">
            {/* Main action button */}
            <button
              onClick={buttonProps.onClick}
              className={`w-full py-2.5 px-4 text-xs font-mono font-semibold rounded-lg transition-all duration-200 outline-none active:scale-[0.97] flex items-center justify-center gap-2 ${buttonProps.className}`}
            >
              {buttonProps.icon}
              {buttonProps.text}
            </button>

            {/* Reset (only during demo) */}
            {demoRunning && (
              <button
                onClick={resetDemo}
                className="w-full py-1.5 px-3 text-[10px] font-mono text-text-tertiary hover:text-text-secondary bg-bg-sunken border border-border-subtle hover:border-border-default rounded-lg transition-all duration-150 outline-none flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}

            {/* Progress bar */}
            {demoTime > 0 && (
              <div className="w-full bg-bg-sunken h-[3px] rounded-full overflow-hidden border border-border-subtle/50 mt-0.5">
                <div
                  className="h-full transition-all duration-300 ease-out rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: progressColor,
                    boxShadow: `0 0 6px ${progressColor}`,
                  }}
                />
              </div>
            )}

            {/* SPACE to start hint */}
            {!demoRunning && demoTime === 0 && (
              <span className="text-[11px] text-text-muted mt-1 flex items-center justify-center gap-1.5 font-mono">
                Press{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-default text-text-tertiary text-[9px] font-mono shadow-sm">
                  SPACE
                </kbd>
                {' '}to start
              </span>
            )}

            {/* Pause hint */}
            {demoRunning && !isPaused && (
              <span className="text-[10px] text-text-muted mt-0.5 flex items-center justify-center gap-2 font-mono">
                <kbd className="px-1 py-0.5 rounded bg-bg-elevated border border-border-subtle text-text-tertiary text-[9px] font-mono">SPACE</kbd>
                pause
                <span className="text-border-active">·</span>
                <kbd className="px-1 py-0.5 rounded bg-bg-elevated border border-border-subtle text-text-tertiary text-[9px] font-mono">R</kbd>
                reset
              </span>
            )}
          </div>

          {/* Footer meta */}
          <div className="flex flex-col gap-0.5 text-center mt-0.5">
            <span className="text-text-muted font-mono-data text-[10px] uppercase tracking-wider">
              Delhi–Howrah Corridor
            </span>
            <span className="text-[9px] text-text-muted font-mono opacity-50">
              prototype v1.0
            </span>
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1.5">
              <span className="text-[9px] text-text-muted font-mono">
                <kbd className="px-1 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-tertiary">1–6</kbd>
                {' '}panels
              </span>
              <span className="text-[9px] text-text-muted font-mono">
                <kbd className="px-1 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-tertiary">M</kbd>
                {' '}audio
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
