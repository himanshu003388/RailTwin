import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { X } from 'lucide-react';
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
      <aside className={`w-[320px] right-sidebar h-dvh bg-bg-card border-l border-border-default p-3 max-sm:p-2 flex flex-col gap-3 max-sm:gap-2 overflow-y-auto shrink-0 select-none scrollbar-thin transition-transform duration-300 ease-in-out max-lg:fixed max-lg:top-0 max-lg:bottom-0 max-lg:right-0 max-lg:z-50 max-sm:w-full max-sm:max-w-[300px] sidebar-accent ${
        mobileRightOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
      }`}>
        {/* Mobile close button */}
        <button
          onClick={() => setMobileRightOpen(false)}
          className="hidden max-lg:flex w-7 h-7 items-center justify-center rounded-md bg-bg-sunken border border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default transition-all duration-150 outline-none cursor-pointer shrink-0 self-end"
          title="Close panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <TimelineScrubber />
        <StationRiskPanel />
      </aside>
    </>
  );
};
