import { TopBar } from './layout/TopBar';
import { Sidebar } from './layout/Sidebar';
import { MainPanel } from './layout/MainPanel';
import { RightSidebar } from './layout/RightSidebar';
import { MobileNav } from './layout/MobileNav';

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
      <MobileNav />
    </div>
  );
}
