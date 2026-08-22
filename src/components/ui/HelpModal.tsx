import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { key: '1-7', desc: 'Switch panels' },
  { key: 'M', desc: 'Toggle audio alerts' },
  { key: '?', desc: 'Toggle Help & Shortcuts' },
  { key: 'Esc', desc: 'Back to Map View / Close' },
];

const PANELS = [
  { num: '1', name: 'Map View', desc: 'Map showing live train locations and station risk levels' },
  { num: '2', name: 'Train Delays', desc: 'Chart showing expected delays at each station' },
  { num: '3', name: 'Disruptions', desc: 'Tracks disruption effects and suggests fixes' },
  { num: '4', name: 'AI Chat', desc: 'Ask questions and get AI answers about corridor conditions' },
  { num: '5', name: 'What-If', desc: 'Test scenarios like rain, signal failure, or track damage' },
  { num: '6', name: 'System Health', desc: 'Overall health, on-time stats, and platform usage' },
  { num: '7', name: 'Drift Monitor', desc: 'Reconciliation: how far the live situation has drifted from the recorded baseline — conflicts, duplicates, partial matches' },
];

export const HelpModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      // Ignore modifier keys pressed alone
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg mx-2 sm:mx-4 shadow-2xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border-default shrink-0">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">Help & Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors duration-150 p-1 cursor-pointer"
            aria-label="Close help"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 overflow-y-auto flex flex-col gap-4 sm:gap-6 scrollbar-thin">
          {/* Shortcuts */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary font-medium mb-3">Shortcuts</h3>
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
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary font-medium mb-3">Panels</h3>
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

          {/* About & Data Sources */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary font-medium mb-2">About & Data Sources</h3>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              RailTwin AI is a predictive digital twin prototype for Indian Railways operations. Its predictive metrics are backed by historical train performance data (compiled from the Kaggle Indian Railways Dataset) and designed to sync with live NTES / IRCTC API feeds.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2 sm:py-3 border-t border-border-default text-center">
          <span className="text-[10px] text-text-tertiary font-mono">Press any key or click outside to close</span>
        </div>
      </div>
    </div>
  );
};
