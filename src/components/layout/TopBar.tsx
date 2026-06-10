import React, { useEffect, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Shield, ShieldAlert, Users, Compass, Clock, Volume2, VolumeX, HelpCircle, Sun, Moon, Settings } from 'lucide-react';
import { HelpModal } from '../ui/HelpModal';
import { SettingsModal } from '../ui/SettingsModal';

export const TopBar: React.FC = () => {
  const demoRunning = useDemoStore(state => state.demoRunning);
  const audioEnabled = useDemoStore(state => state.audioEnabled);
  const toggleAudio = useDemoStore(state => state.toggleAudio);
  const theme = useDemoStore(state => state.theme);
  const toggleTheme = useDemoStore(state => state.toggleTheme);
  const liveApiEnabled = useDemoStore(state => state.liveApiEnabled);
  const apiStatus = useDemoStore(state => state.apiStatus);
  const [timeStr, setTimeStr] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      setTimeStr(`${new Intl.DateTimeFormat('en-US', options).format(new Date())} IST`);
    };
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, []);

  // Live API Polling
  useEffect(() => {
    const updateLiveTrains = useDemoStore.getState().updateLiveTrainsFromApi;
    
    // Fetch immediately if enabled
    if (liveApiEnabled) {
      updateLiveTrains();
    }

    const intervalId = setInterval(() => {
      const state = useDemoStore.getState();
      if (state.liveApiEnabled) {
        state.updateLiveTrainsFromApi();
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(intervalId);
  }, [liveApiEnabled]);

  return (
    <>
      <header
        className="h-12 border-b border-border-default px-4 flex items-center justify-between text-sm select-none shrink-0"
        style={{
          background: 'linear-gradient(180deg, var(--color-bg-elevated) 0%, var(--color-bg-card) 100%)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.03), 0 1px 8px rgba(0,0,0,0.3)',
        }}
      >
        {/* ── Breadcrumb Left ── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-text-tertiary font-mono text-[11px] uppercase tracking-widest">
            <span>Ops Center</span>
            <span className="text-border-active">/</span>
            <span className="text-text-secondary font-semibold tracking-wide">Delhi–Howrah</span>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border select-none ${
              liveApiEnabled && apiStatus === 'connected'
                ? 'bg-accent-green-soft text-accent-green border-accent-green/20'
                : 'bg-accent-blue-soft text-accent-blue border-accent-blue/20'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              liveApiEnabled && apiStatus === 'connected' ? 'bg-accent-green animate-pulse' : 'bg-accent-blue'
            }`} />
            <span>{liveApiEnabled && apiStatus === 'connected' ? 'Live API' : 'Simulated'}</span>
          </div>
        </div>

        {/* ── Center Stat Pills ── */}
        <div className="flex items-center gap-2">
          {/* Passenger Count */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-text-tertiary text-[11px] font-mono"
            style={{
              background: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            <Users className="w-3 h-3 text-text-muted" />
            <span>23M daily passengers</span>
          </div>

          {/* Corridor Length */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-text-tertiary text-[11px] font-mono"
            style={{
              background: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            <Compass className="w-3 h-3 text-text-muted" />
            <span>1,531 km corridor</span>
          </div>

          {/* Live Clock — highlighted */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-text-secondary text-[11px] font-mono"
            style={{
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.2)',
              boxShadow: '0 0 8px rgba(59,130,246,0.12)',
            }}
          >
            <Clock className="w-3 h-3 text-accent-blue" />
            <span
              className="text-text-primary"
              style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}
            >
              {timeStr || '00:00:00 IST'}
            </span>
          </div>
        </div>

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-2">
          {/* Help Button */}
          <button
            onClick={() => setShowHelp(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-bg-sunken border border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default transition-all duration-150 outline-none"
            title="Keyboard shortcuts & help"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-bg-sunken border border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default transition-all duration-150 outline-none cursor-pointer"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-bg-sunken border border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default transition-all duration-150 outline-none cursor-pointer"
            title="Configure Live API"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-bg-sunken border border-border-subtle hover:border-border-default transition-all duration-150 outline-none"
            title={audioEnabled ? 'Mute alerts' : 'Enable audio alerts'}
          >
            {audioEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-accent-green" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' }} />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-text-tertiary" />
            )}
          </button>

          {/* System Status Badge */}
          {demoRunning ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-accent-amber text-[11px] font-mono font-semibold"
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                boxShadow: '0 0 10px rgba(245,158,11,0.15)',
              }}
            >
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-amber opacity-75" />
                <span className="relative inline-flex rounded-full w-2 h-2 bg-accent-amber" style={{ boxShadow: '0 0 6px rgba(245,158,11,0.8)' }} />
              </span>
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Demo Active</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-accent-green text-[11px] font-mono font-semibold"
              style={{
                background: 'rgba(34,197,94,0.07)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              <span className="relative flex w-2 h-2">
                <span className="relative inline-flex rounded-full w-2 h-2 bg-accent-green" style={{ boxShadow: '0 0 5px rgba(34,197,94,0.7)' }} />
              </span>
              <Shield className="w-3.5 h-3.5" />
              <span>Nominal</span>
            </div>
          )}
        </div>
      </header>

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
};
