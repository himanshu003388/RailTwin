import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CorridorMap } from '../map/CorridorMap';
import { StationRiskPanel } from '../panels/StationRiskPanel';
import { DelayChart } from '../panels/DelayChart';
import { SimulationPanel } from '../panels/SimulationPanel';
import { CopilotChat } from '../copilot/CopilotChat';
import { TrainCard } from '../ui/TrainCard';

export const DashboardView: React.FC = () => {
  const activePanel = useDemoStore(state => state.activePanel);
  const trains = useDemoStore(state => state.trains);

  return (
    <div className="flex w-full h-[calc(100vh-48px)] overflow-hidden bg-[#0a0a0a]">
      {/* Left Panel: Digital Twin Corridor Map (always visible to maintain operations view) */}
      <div className="w-[65%] h-full border-r border-[#222222] relative bg-[#0d0d0d]">
        <CorridorMap />
      </div>

      {/* Right Panel: Contextual Telemetry & Controls based on Navigation */}
      <div className="w-[35%] h-full overflow-y-auto bg-[#0a0a0a] flex flex-col border-l border-[#222222] shadow-2xl">
        {activePanel === 'map' && (
          <div className="p-4 flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-wider mb-2">
                Station Corridor Risks
              </h2>
              <StationRiskPanel />
            </div>
            
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-wider mb-1">
                Active Corridor Trains ({trains.length})
              </h2>
              <div className="flex flex-col gap-2">
                {trains.map(train => (
                  <TrainCard key={train.id} train={train} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activePanel === 'delays' && (
          <div className="p-4 h-full flex flex-col">
            <h2 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-wider mb-3">
              Predictive Train Delays
            </h2>
            <div className="flex-1 min-h-[300px]">
              <DelayChart />
            </div>
          </div>
        )}

        {activePanel === 'simulation' && (
          <div className="p-4 h-full flex flex-col">
            <h2 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-wider mb-3">
              Monsoon Cascade Simulation
            </h2>
            <SimulationPanel />
          </div>
        )}

        {activePanel === 'copilot' && (
          <div className="p-0 h-full flex flex-col">
            <CopilotChat />
          </div>
        )}
      </div>
    </div>
  );
};
