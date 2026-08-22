import React, { useEffect, useRef } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CorridorMap } from '../map/CorridorMap';
import { DelayChart } from '../panels/DelayChart';
import { SimulationPanel } from '../panels/SimulationPanel';
import { CopilotChat } from '../copilot/CopilotChat';
import { WhatIfPanel } from '../panels/WhatIfPanel';
import { HealthDashboard } from '../panels/HealthDashboard';
import { ReconciliationPanel } from '../panels/ReconciliationPanel';

export const MainPanel: React.FC = () => {
  const activePanel = useDemoStore(state => state.activePanel);
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
            : 'h-[100px] sm:h-[130px] md:h-[160px] border-b border-border-default shrink-0 max-md:hidden'
        }`}
      >
        <CorridorMap />
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
