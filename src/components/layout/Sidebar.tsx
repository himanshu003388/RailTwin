import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Train, MapPin, Clock, Zap, Bot } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const activePanel = useDemoStore(state => state.activePanel);
  const demoRunning = useDemoStore(state => state.demoRunning);
  const demoTime = useDemoStore(state => state.demoTime);
  const startDemo = useDemoStore(state => state.startDemo);
  const resetDemo = useDemoStore(state => state.resetDemo);
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

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable
        )) {
          return;
        }

        e.preventDefault();

        if (!demoRunning) {
          startDemo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [demoRunning, startDemo]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const getButtonProps = () => {
    if (demoRunning) {
      return {
        className: 'bg-[#1a1a1a] border border-[#333333] text-white hover:bg-[#222222]/80',
        text: `Demo running — ${formatTime(demoTime)}`,
        onClick: resetDemo,
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
      className: 'bg-[#3b82f6] hover:bg-[#2563eb] border border-[#3b82f6]/20 text-white',
      text: '▶ Run Demo Scenario',
      onClick: startDemo,
    };
  };

  const buttonProps = getButtonProps();

  const navItems = [
    { id: 'map' as const, label: 'Map View', icon: MapPin },
    { id: 'delays' as const, label: 'Train Delays', icon: Clock },
    { id: 'simulation' as const, label: 'Simulation Panel', icon: Zap },
    { id: 'copilot' as const, label: 'AI Copilot', icon: Bot },
  ];

  return (
    <aside className="w-[240px] h-screen bg-[#111111] border-r border-[#222222] flex flex-col justify-between select-none">
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
      <div className="p-4 flex flex-col gap-3 border-t border-[#222222] bg-[#0c0c0c]">
        <div className="flex flex-col gap-1">
          <button
            onClick={buttonProps.onClick}
            className={`w-full py-2.5 px-4 text-xs font-mono font-medium rounded-lg shadow-md transition-all duration-200 outline-none active:scale-[0.98] ${buttonProps.className}`}
          >
            {buttonProps.text}
          </button>

          {/* Progress bar */}
          {demoTime > 0 && (
            <div className="w-full bg-[#222222] h-[2px] rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-300 ease-out ${
                  demoTime === 50 && !demoRunning ? 'bg-[#22c55e]' : 'bg-[#3b82f6]'
                }`}
                style={{ width: `${(demoTime / 50) * 100}%` }}
              />
            </div>
          )}

          {/* SPACE to start hint */}
          {!demoRunning && demoTime === 0 && (
            <span className="text-[10px] text-[#555555] mt-1.5 flex items-center justify-center gap-1.5 font-mono">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#333333] text-[#888888] text-[9px] font-mono shadow-sm">SPACE</kbd> to start
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
        </div>
      </div>
    </aside>
  );
};
