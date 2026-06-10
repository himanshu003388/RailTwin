import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CorridorMap } from '../map/CorridorMap';

interface MainPanelProps {
  delays?: React.ReactNode;
  simulation?: React.ReactNode;
  copilot?: React.ReactNode;
}

export const MainPanel: React.FC<MainPanelProps> = ({
  delays,
  simulation,
  copilot
}) => {
  const activePanel = useDemoStore(state => state.activePanel);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-[#0a0a0a]">
      {/* Dynamic panel transition animation styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes panel-fade-slide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-panel-in {
          animation: panel-fade-slide 200ms ease-out forwards;
        }
      ` }} />

      {/* Map area (always rendered to keep MapLibre instance alive) */}
      <div
        className={`w-full relative transition-all duration-300 ease-in-out ${
          activePanel === 'map'
            ? 'flex-1 h-full'
            : 'h-[180px] border-b border-[#222222] shrink-0'
        }`}
      >
        <CorridorMap />
      </div>

      {/* Details area for other panels */}
      {activePanel !== 'map' && (
        <div className="flex-1 w-full overflow-hidden p-4 relative animate-panel-in bg-[#0a0a0a]">
          {activePanel === 'delays' && delays}
          {activePanel === 'simulation' && simulation}
          {activePanel === 'copilot' && copilot}
        </div>
      )}
    </div>
  );
};
