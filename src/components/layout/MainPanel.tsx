import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CorridorMap } from '../map/CorridorMap';
import { DelayChart } from '../panels/DelayChart';
import { SimulationPanel } from '../panels/SimulationPanel';
import { CopilotChat } from '../copilot/CopilotChat';
import { WhatIfPanel } from '../panels/WhatIfPanel';
import { HealthDashboard } from '../panels/HealthDashboard';

export const MainPanel: React.FC = () => {
  const activePanel = useDemoStore(state => state.activePanel);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-bg-page">
      {/* Map area (always rendered to keep MapLibre instance alive) */}
      <div
        className={`w-full relative transition-all duration-300 ease-in-out ${
          activePanel === 'map'
            ? 'flex-1 h-full'
            : 'h-[180px] border-b border-border-default shrink-0 max-md:hidden'
        }`}
      >
        <CorridorMap />
      </div>

      {/* Details area for other panels */}
      {activePanel !== 'map' && (
        <div className="flex-1 w-full overflow-hidden p-4 relative animate-panel-in bg-bg-page">
          {activePanel === 'delays' && <DelayChart />}
          {activePanel === 'simulation' && <SimulationPanel />}
          {activePanel === 'copilot' && <CopilotChat />}
          {activePanel === 'whatif' && <WhatIfPanel />}
          {activePanel === 'health' && <HealthDashboard />}
        </div>
      )}
    </div>
  );
};
