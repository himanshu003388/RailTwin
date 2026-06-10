import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { key: '1-6', desc: 'Switch panels (Map, Delays, Simulation, Copilot, What-If, Health)' },
  { key: 'Space', desc: 'Start / pause the demo' },
  { key: 'R', desc: 'Reset the demo' },
  { key: 'M', desc: 'Toggle audio alerts' },
  { key: 'Esc', desc: 'Return to Map view' },
];

const PANELS = [
  { num: '1', name: 'Map View', desc: 'Interactive corridor map with live train positions and station risk indicators' },
  { num: '2', name: 'Train Delays', desc: 'Delay prediction chart showing accumulated delay per station' },
  { num: '3', name: 'Simulation', desc: 'Cascade simulation engine with conflict detection and AI recommendations' },
  { num: '4', name: 'AI Copilot', desc: 'Ask questions about corridor status and get AI-powered analysis' },
  { num: '5', name: 'What-If Lab', desc: 'Test disruption scenarios (rainfall, signal failure, track damage, fog)' },
  { num: '6', name: 'System Health', desc: 'Network efficiency, on-time performance, and platform utilization' },
];

export const HelpModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts & Panel Guide</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors duration-150 p-1"
            aria-label="Close help"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex flex-col gap-6 scrollbar-thin">
          {/* Shortcuts */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary font-medium mb-3">Keyboard Shortcuts</h3>
            <div className="flex flex-col gap-1.5">
              {SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center gap-3 py-1.5">
                  <kbd className="min-w-[48px] px-2 py-1 bg-bg-elevated border border-border-default rounded text-[11px] font-mono text-text-secondary text-center shadow-sm">
                    {s.key}
                  </kbd>
                  <span className="text-xs text-text-secondary">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panels */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary font-medium mb-3">Panel Overview</h3>
            <div className="flex flex-col gap-2">
              {PANELS.map(p => (
                <div key={p.num} className="flex items-start gap-3 py-2 border-b border-border-subtle last:border-0">
                  <span className="w-5 h-5 rounded bg-bg-elevated border border-border-default flex items-center justify-center text-[10px] font-mono font-bold text-accent-blue flex-shrink-0 mt-0.5">
                    {p.num}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-text-primary">{p.name}</span>
                    <span className="text-[11px] text-text-secondary">{p.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-default text-center">
          <span className="text-[10px] text-text-tertiary font-mono">Press any key or click outside to close</span>
        </div>
      </div>
    </div>
  );
};
