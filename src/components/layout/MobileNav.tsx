import React from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Map, TrendingUp, Activity, Bot, FlaskConical, HeartPulse, GitCompare } from 'lucide-react';

const ITEMS = [
  { id: 'map', label: 'Map', Icon: Map },
  { id: 'delays', label: 'Delays', Icon: TrendingUp },
  { id: 'simulation', label: 'Sim', Icon: Activity },
  { id: 'copilot', label: 'AI Chat', Icon: Bot },
  { id: 'whatif', label: 'What-If', Icon: FlaskConical },
  { id: 'health', label: 'Health', Icon: HeartPulse },
  { id: 'reconciliation', label: 'Drift', Icon: GitCompare },
] as const;

export const MobileNav: React.FC = () => {
  const activePanel = useDemoStore(state => state.activePanel);
  const setActivePanel = useDemoStore(state => state.setActivePanel);

  return (
    <nav className="mobile-nav" aria-label="Primary navigation">
      {ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className="mobile-nav-item"
          data-active={activePanel === id}
          aria-current={activePanel === id ? 'page' : undefined}
          aria-label={label}
          onClick={() => setActivePanel(id as any)}
        >
          <Icon className="w-5 h-5 shrink-0" strokeWidth={activePanel === id ? 2.4 : 1.8} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
        </button>
      ))}
    </nav>
  );
};
