import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Train, MapPin, Clock, Zap, Bot, TestTube, Activity, GitCompare, X } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const activePanel = useDemoStore(state => state.activePanel);
  const setActivePanel = useDemoStore(state => state.setActivePanel);
  const mobileLeftOpen = useDemoStore(state => state.mobileLeftOpen);
  const setMobileLeftOpen = useDemoStore(state => state.setMobileLeftOpen);

  const navItems = [
    { id: 'map'        as const, label: 'Map View',      icon: MapPin   },
    { id: 'delays'     as const, label: 'Train Delays',  icon: Clock    },
    { id: 'simulation' as const, label: 'Disruptions',   icon: Zap      },
    { id: 'copilot'    as const, label: 'AI Chat',       icon: Bot      },
    { id: 'whatif'     as const, label: 'What-If Lab',   icon: TestTube },
    { id: 'health'     as const, label: 'System Health', icon: Activity },
    { id: 'reconciliation' as const, label: 'Drift Monitor', icon: GitCompare },
  ];

  const handleSelectPanel = (id: typeof navItems[number]['id']) => {
    setActivePanel(id);
    setMobileLeftOpen(false);
  };

  return (
    <>
      {mobileLeftOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden cursor-pointer animate-fade-in"
          onClick={() => setMobileLeftOpen(false)}
        />
      )}
      <aside className={`w-[240px] sidebar-left h-dvh bg-bg-card border-r border-border-default flex flex-col justify-between select-none shrink-0 transition-transform duration-300 ease-in-out max-lg:fixed max-lg:top-0 max-lg:bottom-0 max-lg:left-0 max-lg:z-50 max-sm:w-full max-sm:max-w-[280px] sidebar-accent overflow-y-auto scrollbar-thin ${
        mobileLeftOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
      }`}>
        <div className="flex flex-col gap-4 p-3.5 sm:p-4">
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
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

            <button
              onClick={() => setMobileLeftOpen(false)}
              className="lg:hidden w-7 h-7 flex items-center justify-center rounded-md bg-bg-sunken border border-border-subtle text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              title="Close menu"
              aria-label="Close navigation menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <nav className="flex flex-col gap-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectPanel(item.id)}
                  className={`relative flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-md transition-all duration-150 text-left outline-none overflow-hidden cursor-pointer ${
                    isActive
                      ? 'bg-bg-elevated text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60'
                  }`}
                >
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

        <div
          className="p-4 flex flex-col gap-3 border-t border-border-default"
          style={{ background: 'linear-gradient(180deg, var(--color-bg-card) 0%, var(--color-bg-sunken) 100%)' }}
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.7)' }} />
              <span className="uppercase tracking-wider">Live Network</span>
            </div>
          </div>

          <div className="flex flex-col gap-0.5 text-center mt-0.5">
            <span className="text-text-muted font-mono-data text-[10px] uppercase tracking-wider">
              Indian Railways Network
            </span>
            <span className="text-[9px] text-text-muted font-mono opacity-50">
              prototype v1.0
            </span>
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1.5">
              <span className="text-[9px] text-text-muted font-mono">
                <kbd className="px-1 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-tertiary">1–7</kbd>
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
