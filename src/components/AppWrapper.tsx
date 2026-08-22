import React, { useEffect } from 'react';
import { TopBar } from './layout/TopBar';
import { Sidebar } from './layout/Sidebar';
import { MainPanel } from './layout/MainPanel';
import { RightSidebar } from './layout/RightSidebar';
import { MobileNav } from './layout/MobileNav';
import { useDemoStore } from '../stores/demoStore';
import { useDriftStore } from '../stores/driftStore';

export default function AppWrapper() {
  const activePanel = useDemoStore(state => state.activePanel);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activePanel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'replay') {
      useDemoStore.setState({ activePanel: 'reconciliation' });
      useDemoStore.getState().addToast({
        type: 'info',
        title: 'Judge Demo Mode',
        message: 'Auto-switched to Drift Monitor. 60-second deterministic replay starting in 3 seconds...',
      });
      const timer = setTimeout(() => {
        useDriftStore.getState().startReplay();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

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
      <MobileNav />
    </div>
  );
}
