import React from 'react';

interface RightSidebarProps {
  children?: React.ReactNode;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ children }) => {
  return (
    <aside className="w-[320px] right-sidebar h-screen bg-[#0d0d0d] border-l border-[#1a1a1a] p-3 flex flex-col gap-3 overflow-y-auto shrink-0 select-none scrollbar-thin">
      {children}
    </aside>
  );
};
