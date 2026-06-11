import React from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { TopBar } from './layout/TopBar';
import { Sidebar } from './layout/Sidebar';
import { MainPanel } from './layout/MainPanel';
import { RightSidebar } from './layout/RightSidebar';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-page)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-purple)', borderTopColor: 'transparent' }} />
          <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>Loading RailTwin...</span>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

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

export default function AppWrapper() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
