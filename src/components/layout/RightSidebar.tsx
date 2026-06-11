import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { TimelineScrubber } from '../ui/TimelineScrubber';
import { StationRiskPanel } from '../panels/StationRiskPanel';

export const RightSidebar: React.FC = () => {
  const mobileRightOpen = useDemoStore(state => state.mobileRightOpen);
  const setMobileRightOpen = useDemoStore(state => state.setMobileRightOpen);

  return (
    <>
      {mobileRightOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden cursor-pointer"
          onClick={() => setMobileRightOpen(false)}
        />
      )}
      <aside className={`w-[320px] right-sidebar h-screen bg-bg-card border-l border-border-default p-3 flex flex-col gap-3 overflow-y-auto shrink-0 select-none scrollbar-thin transition-transform duration-300 ease-in-out max-lg:fixed max-lg:top-0 max-lg:bottom-0 max-lg:right-0 max-lg:z-50 ${
        mobileRightOpen ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'
      }`}>
        <TimelineScrubber />
        <StationRiskPanel />
      </aside>
    </>
  );
};
