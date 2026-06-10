import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { useDemoStore } from '../../stores/demoStore';
import { testApiKey } from '../../services/railwayService';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const liveApiEnabled = useDemoStore(state => state.liveApiEnabled);
  const rapidApiKey = useDemoStore(state => state.rapidApiKey);
  const rapidApiHost = useDemoStore(state => state.rapidApiHost);
  const setApiConfig = useDemoStore(state => state.setApiConfig);

  const [enabled, setEnabled] = useState(liveApiEnabled);
  const [key, setKey] = useState(rapidApiKey);
  const [host, setHost] = useState(rapidApiHost);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'failed'>('idle');

  // Synchronize internal state when store values change
  useEffect(() => {
    setEnabled(liveApiEnabled);
    setKey(rapidApiKey);
    setHost(rapidApiHost);
    setTestResult('idle');
  }, [liveApiEnabled, rapidApiKey, rapidApiHost, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    setApiConfig({ enabled, key: key.trim(), host: host.trim() });
    onClose();
  };

  const handleTest = async () => {
    if (!key.trim()) return;
    setTesting(true);
    setTestResult('idle');
    const isWorking = await testApiKey(key.trim(), host.trim());
    setTesting(false);
    setTestResult(isWorking ? 'success' : 'failed');
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-default rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden flex flex-col animate-panel-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">Live Tracking Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors duration-150 p-1"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-text-primary">Enable Live API</span>
              <span className="text-[10px] text-text-secondary">Fetch real-time delay & speed metrics</span>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-250 ease-out outline-none cursor-pointer ${
                enabled ? 'bg-accent-blue' : 'bg-bg-hover border border-border-default'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white transition-transform duration-250 ease-out ${
                  enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-border-subtle" />

          {/* Form */}
          <div className="flex flex-col gap-4">
            {/* Key Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider font-mono">
                  RapidAPI Key
                </label>
                <a
                  href="https://rapidapi.com/IRCTCAPI/api/irctc1/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-accent-blue hover:underline"
                >
                  Get Free Key
                </a>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
                <input
                  type="password"
                  placeholder="Enter x-rapidapi-key..."
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-bg-sunken border border-border-default text-xs text-text-primary focus:border-accent-blue placeholder-text-tertiary outline-none transition-colors duration-150"
                  disabled={!enabled}
                />
              </div>
            </div>

            {/* Host Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider font-mono">
                RapidAPI Host
              </label>
              <input
                type="text"
                placeholder="irctc1.p.rapidapi.com"
                value={host}
                onChange={e => setHost(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-bg-sunken border border-border-default text-xs text-text-primary focus:border-accent-blue placeholder-text-tertiary outline-none transition-colors duration-150"
                disabled={!enabled}
              />
            </div>

            {/* Connection Status & Test Button */}
            {enabled && key.trim() && (
              <div className="flex items-center justify-between gap-3 mt-1.5 bg-bg-sunken border border-border-subtle p-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 text-text-tertiary animate-spin" />
                  ) : testResult === 'success' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-accent-green" />
                  ) : testResult === 'failed' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-accent-red" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
                  )}
                  <span className="text-[10px] text-text-secondary font-mono">
                    {testing
                      ? 'Testing credentials...'
                      : testResult === 'success'
                      ? 'Connection verified'
                      : testResult === 'failed'
                      ? 'Invalid credentials'
                      : 'Test API Connection'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="px-2.5 py-1 text-[10px] font-semibold font-mono rounded bg-bg-elevated border border-border-default text-text-primary hover:border-border-hover disabled:opacity-50 transition-colors duration-150 cursor-pointer"
                >
                  Verify
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-bg-sunken border-t border-border-default flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-accent-blue hover:opacity-90 active:scale-[0.98] rounded-md transition-all duration-150 cursor-pointer"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};
