import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Train, MapPin, Clock, Zap, Bot, TestTube, Activity, Pause, Play, RotateCcw } from 'lucide-react';

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

  const [showComplete, setShowComplete] = React.useState(false);

  React.useEffect(() => {
    if (demoTime === 50 && !demoRunning) {
      setShowComplete(true);
      const timer = setTimeout(() => {
        setShowComplete(false);
      }, 3000);
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
        className: 'bg-[#1a1a1a] border border-[#333333] text-white hover:bg-[#222222]/80',
        text: `Pause Demo — ${formatTime(demoTime)}`,
        onClick: pauseDemo,
      };
    }

    if (demoRunning && isPaused) {
      return {
        className: 'bg-[#3b82f6] hover:bg-[#2563eb] border border-[#3b82f6]/20 text-white',
        text: `Resume — ${formatTime(demoTime)}`,
        onClick: resumeDemo,
      };
    }

    if (demoTime === 50) {
      if (showComplete) {
        return {
          className: 'bg-[#22c55e] border border-[#22c55e]/20 text-white',
          text: '✓ Demo Complete',
          onClick: resetDemo,
        };
      } else {
        return {
          className: 'bg-[#1a1a1a] border border-[#222222] text-[#888888] hover:text-white hover:bg-[#222222]',
          text: '↺ Reset Demo',
          onClick: resetDemo,
        };
      }
    }

    return {
      className: 'bg-[#3b82f6] hover:bg-[#2563eb] border border-[#3b82f6]/30 text-white shadow-[0_0_16px_rgba(59,130,246,0.3)]',
      text: '▶ Run Demo Scenario',
      onClick: startDemo,
    };
  };

  const buttonProps = getButtonProps();

  const navItems = [
    { id: 'map' as const, label: 'Map View', icon: MapPin },
    { id: 'delays' as const, label: 'Train Delays', icon: Clock },
    { id: 'simulation' as const, label: 'Simulation', icon: Zap },
    { id: 'copilot' as const, label: 'AI Copilot', icon: Bot },
    { id: 'whatif' as const, label: 'What-If Lab', icon: TestTube },
    { id: 'health' as const, label: 'System Health', icon: Activity },
  ];

  return (
    <aside className="w-[240px] sidebar-left h-screen bg-bg-card border-r border-border-default flex flex-col justify-between select-none shrink-0">
      {/* Top Header & Brand */}
      <div className="flex flex-col gap-6 p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#222222] flex items-center justify-center text-[#3b82f6] shadow-sm">
            <Train className="w-4 h-4" />
          </div>
          <div className="flex items-center">
            <span className="font-sans font-medium text-white tracking-tight text-base">
              RailTwin
            </span>
            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 uppercase">
              AI
            </span>
          </div>
        </div>

        {/* Navigation Link List */}
        <nav className="flex flex-col gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activePanel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded transition-all duration-150 text-left outline-none ${
                  isActive
                    ? 'bg-[#1a1a1a] text-white border-l-2 border-[#3b82f6]'
                    : 'text-[#888888] hover:text-[#cccccc] hover:bg-[#161616]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#3b82f6]' : 'text-[#888888]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom controls */}
      <div className="p-4 flex flex-col gap-3 border-t border-border-default bg-[#0c0c0c]">
        <div className="flex flex-col gap-1.5">
          {/* Main action button */}
          <button
            onClick={buttonProps.onClick}
            className={`w-full py-2.5 px-4 text-xs font-mono font-medium rounded-lg shadow-md transition-all duration-200 outline-none active:scale-[0.98] ${buttonProps.className}`}
          >
            {buttonProps.text}
          </button>

          {/* Reset button (only during demo) */}
          {demoRunning && (
            <button
              onClick={resetDemo}
              className="w-full py-1.5 px-3 text-[10px] font-mono text-[#666666] hover:text-[#888888] bg-[#111111] border border-[#222222] hover:border-[#333333] rounded-lg transition-all duration-150 outline-none flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Demo
            </button>
          )}

          {/* Progress bar */}
          {demoTime > 0 && (
            <div className="w-full bg-[#1a1a1a] h-[3px] rounded-full overflow-hidden mt-1 border border-[#222222]/50">
              <div
                className={`h-full transition-all duration-300 ease-out rounded-full ${
                  demoTime === 50 && !demoRunning ? 'bg-[#22c55e]' : isPaused ? 'bg-[#f59e0b]' : 'bg-[#3b82f6]'
                }`}
                style={{ width: `${(demoTime / 50) * 100}%` }}
              />
            </div>
          )}

          {/* SPACE to start hint */}
          {!demoRunning && demoTime === 0 && (
            <span className="text-[11px] text-[#555555] mt-1.5 flex items-center justify-center gap-1.5 font-mono">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#333333] text-[#888888] text-[10px] font-mono shadow-sm">SPACE</kbd> to start
            </span>
          )}

          {/* Pause hint */}
          {demoRunning && !isPaused && (
            <span className="text-[10px] text-[#444444] mt-0.5 flex items-center justify-center gap-1.5 font-mono">
              <kbd className="px-1 py-0.5 rounded bg-[#1a1a1a] border border-[#333] text-[#555] text-[9px] font-mono">SPACE</kbd> pause
              <span className="text-[#333]">·</span>
              <kbd className="px-1 py-0.5 rounded bg-[#1a1a1a] border border-[#333] text-[#555] text-[9px] font-mono">R</kbd> reset
            </span>
          )}
        </div>

        <div className="flex flex-col gap-0.5 text-center mt-1">
          <span className="text-[#555555] font-mono-data text-[10px] uppercase tracking-wider">
            Delhi–Howrah Corridor
          </span>
          <span className="text-[9px] text-[#333333] font-mono">
            Hackathon prototype v1.0
          </span>
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1.5">
            <span className="text-[9px] text-[#333] font-mono">
              <kbd className="px-1 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-[#555]">1-6</kbd> panels
            </span>
            <span className="text-[9px] text-[#333] font-mono">
              <kbd className="px-1 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-[#555]">M</kbd> audio
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
