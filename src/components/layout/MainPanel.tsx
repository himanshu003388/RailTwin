import React, { useEffect, useRef } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CorridorMap } from '../map/CorridorMap';
import { DelayChart } from '../panels/DelayChart';
import { SimulationPanel } from '../panels/SimulationPanel';
import { CopilotChat } from '../copilot/CopilotChat';
import { WhatIfPanel } from '../panels/WhatIfPanel';
import { HealthDashboard } from '../panels/HealthDashboard';
import { ReconciliationPanel } from '../panels/ReconciliationPanel';
import { Maximize2, MapPin } from 'lucide-react';

export const MainPanel: React.FC = () => {
  const activePanel = useDemoStore(state => state.activePanel);
  const setActivePanel = useDemoStore(state => state.setActivePanel);
  const trains = useDemoStore(state => state.trains);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [activePanel]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden h-full min-h-0 w-full bg-bg-page relative">
      {/* Subtle blue accent bar at top of main content */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-blue/15 to-transparent pointer-events-none z-10" />

      {/* Map area (always rendered to keep MapLibre instance alive) */}
      <div
        className={`w-full relative transition-all duration-300 ease-in-out ${
          activePanel === 'map'
            ? 'flex-1 min-h-0 gradient-border overflow-hidden'
            : 'h-[110px] sm:h-[135px] md:h-[155px] border-b border-border-default shrink-0 cursor-pointer group select-none overflow-hidden'
        }`}
        onClick={activePanel !== 'map' ? () => setActivePanel('map') : undefined}
        role={activePanel !== 'map' ? 'button' : undefined}
        tabIndex={activePanel !== 'map' ? 0 : undefined}
        onKeyDown={
          activePanel !== 'map'
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActivePanel('map');
                }
              }
            : undefined
        }
        title={activePanel !== 'map' ? 'Click to expand to full Map View' : undefined}
        aria-label={activePanel !== 'map' ? 'Expand live map to full view' : undefined}
      >
        <CorridorMap />

        {/* Interactive Expand Overlay for Mini Map Preview */}
        {activePanel !== 'map' && (
          <div className="absolute inset-0 bg-gradient-to-t from-bg-card/90 via-bg-page/25 to-transparent backdrop-blur-[0.5px] group-hover:bg-accent-blue/10 group-hover:backdrop-blur-none transition-all duration-200 flex items-center justify-between px-3 sm:px-5 pointer-events-none">
            {/* Left Pill: Live telemetry status */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-elevated/90 backdrop-blur-md border border-border-default shadow-md pointer-events-auto group-hover:border-accent-blue/30 transition-colors">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                <span className="relative inline-flex rounded-full w-2 h-2 bg-accent-green" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.8)' }} />
              </span>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-accent-blue" />
                <span className="text-[10px] sm:text-[11px] font-bold text-text-primary font-sans tracking-wide">
                  Live National Map
                </span>
                <span className="hidden sm:inline-block text-[9px] text-text-tertiary font-mono">
                  · {trains.length} trains active
                </span>
              </div>
            </div>

            {/* Right Action Pill: Expand Call to Action */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated/95 group-hover:bg-accent-blue border border-border-default group-hover:border-accent-blue text-text-primary group-hover:text-white shadow-lg group-hover:shadow-[0_0_16px_rgba(59,130,246,0.4)] transition-all duration-200 pointer-events-auto transform group-hover:scale-105">
              <Maximize2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-45" />
              <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider">
                Click to Expand Map
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Details area for other panels */}
      {activePanel !== 'map' && (
        <div
          className={`flex-1 w-full min-h-0 relative animate-panel-in bg-bg-page ${
            activePanel === 'copilot'
              ? 'overflow-hidden flex flex-col p-0'
              : 'overflow-y-auto p-2.5 sm:p-4 md:p-5 scrollbar-thin'
          }`}
        >
          {activePanel === 'delays' && <DelayChart />}
          {activePanel === 'simulation' && <SimulationPanel />}
          {activePanel === 'copilot' && <CopilotChat />}
          {activePanel === 'whatif' && <WhatIfPanel />}
          {activePanel === 'health' && <HealthDashboard />}
          {activePanel === 'reconciliation' && <ReconciliationPanel />}
        </div>
      )}
    </div>
  );
};

