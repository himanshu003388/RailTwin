import React from 'react';
import { TopBar } from './layout/TopBar';
import { Sidebar } from './layout/Sidebar';
import { MainPanel } from './layout/MainPanel';
import { RightSidebar } from './layout/RightSidebar';

export default function AppWrapper() {
  return (
    <div className="dashboard-shell">
      <TopBar />
      <div className="dashboard-body">
        <Sidebar />
        <main className="dashboard-main">
          <MainPanel />
        </main>
        <RightSidebar />
      </div>
    </div>
  );
}
