import React from 'react';
import { TimelineScrubber } from '../ui/TimelineScrubber';
import { StationRiskPanel } from '../panels/StationRiskPanel';

export const RightSidebar: React.FC = () => {
  return (
    <aside className="w-[320px] right-sidebar h-screen bg-bg-card border-l border-border-default p-3 flex flex-col gap-3 overflow-y-auto shrink-0 select-none scrollbar-thin">
      <TimelineScrubber />
      <StationRiskPanel />
    </aside>
  );
};
