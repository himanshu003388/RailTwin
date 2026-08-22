import React, { useEffect, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Users, Compass, Clock, Volume2, VolumeX, HelpCircle, Sun, Moon, Settings, Menu, List, GitCompare } from 'lucide-react';
import { HelpModal } from '../ui/HelpModal';
import { SettingsModal } from '../ui/SettingsModal';
import { useDriftStore } from '../../stores/driftStore';

const DRIFT_BADGE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  stable:      { color: 'var(--color-risk-low)',      bg: 'rgba(34,197,94,0.07)',  border: 'rgba(34,197,94,0.2)'  },
  minor:       { color: 'var(--color-risk-moderate)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
  significant: { color: 'var(--color-risk-high)',     bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
  critical:    { color: 'var(--color-risk-critical)', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'  },
};

export const TopBar: React.FC = () => {
  const audioEnabled = useDemoStore(state => state.audioEnabled);
  const toggleAudio = useDemoStore(state => state.toggleAudio);
  const theme = useDemoStore(state => state.theme);
  const toggleTheme = useDemoStore(state => state.toggleTheme);
  const liveApiEnabled = useDemoStore(state => state.liveApiEnabled);
  const apiStatus = useDemoStore(state => state.apiStatus);
  const loading = useDemoStore(state => state.loading);
  const lastUpdated = useDemoStore(state => state.lastUpdated);
  const mobileLeftOpen = useDemoStore(state => state.mobileLeftOpen);
  const setMobileLeftOpen = useDemoStore(state => state.setMobileLeftOpen);
  const mobileRightOpen = useDemoStore(state => state.mobileRightOpen);
  const setMobileRightOpen = useDemoStore(state => state.setMobileRightOpen);
  const [timeStr, setTimeStr] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const setActivePanel = useDemoStore(state => state.setActivePanel);
  const driftReport = useDriftStore(state => state.driftReport);
  const openReconCount = useDriftStore(state => state.reconItems.filter(i => i.status === 'open').length);

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
    if (liveApiEnabled) {
      updateLiveTrains();
    }
    const intervalId = setInterval(() => {
      const state = useDemoStore.getState();
      if (state.liveApiEnabled) {
        state.updateLiveTrainsFromApi();
      }
    }, 30000);
    return () => clearInterval(intervalId);
  }, [liveApiEnabled]);

  // Weather API Polling
  useEffect(() => {
    const fetchWeather = useDemoStore.getState().fetchLiveWeatherForCorridor;
    fetchWeather();
    const intervalId = setInterval(fetchWeather, 3 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <>
      <header
        className="h-12 border-b border-border-default px-2 sm:px-3 md:px-4 flex items-center justify-between gap-1.5 sm:gap-2 text-sm select-none shrink-0 w-full overflow-hidden"
        style={{
          background: 'linear-gradient(90deg, var(--color-bg-elevated) 0%, var(--color-bg-card) 50%, rgba(37,99,235,0.05) 100%)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.03), 0 1px 8px rgba(0,0,0,0.3), inset 0 -2px 0 var(--color-accent-blue-soft), inset 0 0 20px rgba(37,99,235,0.08)',
        }}
      >
        {/* ── Breadcrumb Left ── */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
          <button
            onClick={() => setMobileLeftOpen(!mobileLeftOpen)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-bg-sunken border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-all duration-150 outline-none cursor-pointer shrink-0 active:scale-95"
            title="Toggle Menu"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 text-text-tertiary font-mono text-[10px] sm:text-[11px] uppercase tracking-wider truncate">
            <span className="hidden md:inline">Control Center</span>
            <span className="text-border-active hidden md:inline">/</span>
            <span className="text-text-primary font-semibold truncate">National Network</span>
          </div>

          {/* LIVE Indicator */}
          <div
            className="flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono uppercase tracking-wider border select-none shrink-0 bg-accent-green-soft text-accent-green border-accent-green/20"
          >
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-accent-green" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.8)' }} />
            </span>
            <span className="hidden xs:inline sm:inline">LIVE</span>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono uppercase tracking-wider border bg-accent-amber-soft text-accent-amber border-accent-amber/20">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse" />
              <span>Syncing…</span>
            </div>
          )}

          {/* API Status */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-mono uppercase tracking-wider border select-none shrink-0 ${
              liveApiEnabled && apiStatus === 'connected'
                ? 'bg-accent-green-soft text-accent-green border-accent-green/20'
                : liveApiEnabled && apiStatus === 'connecting'
                ? 'bg-accent-amber-soft text-accent-amber border-accent-amber/20'
                : 'bg-accent-blue-soft text-accent-blue border-accent-blue/20'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              liveApiEnabled && apiStatus === 'connected'
                ? 'bg-accent-green animate-pulse'
                : liveApiEnabled && apiStatus === 'connecting'
                ? 'bg-accent-amber animate-pulse'
                : 'bg-accent-blue'
            }`} />
            <span>{liveApiEnabled && apiStatus === 'connected' ? 'API' : liveApiEnabled && apiStatus === 'connecting' ? '…' : 'Simulated'}</span>
          </div>
        </div>

        {/* ── Center Stat Pills ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live Clock */}
          <div
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-text-secondary text-[10px] sm:text-[11px] font-mono"
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.06) 100%)',
              border: '1px solid rgba(37,99,235,0.30)',
              boxShadow: '0 0 12px rgba(37,99,235,0.18)',
            }}
          >
            <Clock className="w-3 h-3 text-accent-blue hidden sm:block shrink-0" />
            <span
              className="text-text-primary font-medium"
              style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}
            >
              {timeStr || '00:00:00 IST'}
            </span>
          </div>

          {/* Passenger Count (Desktop) */}
          <div
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-text-tertiary text-[11px] font-mono"
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.03) 100%)',
              border: '1px solid rgba(37,99,235,0.15)',
              boxShadow: 'inset 0 1px 2px rgba(37,99,235,0.06)',
            }}
          >
            <Users className="w-3 h-3 text-accent-blue shrink-0" />
            <span>23M daily passengers</span>
          </div>

          {/* Corridor Length (Desktop) */}
          <div
            className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-text-tertiary text-[11px] font-mono"
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.03) 100%)',
              border: '1px solid rgba(37,99,235,0.15)',
              boxShadow: 'inset 0 1px 2px rgba(37,99,235,0.06)',
            }}
          >
            <Compass className="w-3 h-3 text-accent-blue shrink-0" />
            <span>1,531 km corridor</span>
          </div>
        </div>

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Drift Indicator badge — Round 2 */}
          {driftReport && (() => {
            const s = DRIFT_BADGE_STYLES[driftReport.corridorClass] || DRIFT_BADGE_STYLES.stable;
            return (
              <button
                onClick={() => setActivePanel('reconciliation')}
                className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-mono font-semibold shrink-0 outline-none cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
                style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
                title={`Corridor drift ${Math.round(driftReport.corridorScore)}/100 (${driftReport.corridorClass}) — ${openReconCount} open reconciliation item(s). Click to open the Drift Monitor.`}
              >
                <GitCompare className="w-3 h-3 shrink-0" />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(driftReport.corridorScore)}</span>
                <span className="hidden sm:inline uppercase tracking-wider">drift</span>
                {openReconCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[14px] h-3.5 px-1 rounded-full text-[8px] font-bold"
                    style={{ background: s.color, color: 'var(--color-bg-page)' }}
                  >
                    {openReconCount}
                  </span>
                )}
              </button>
            );
          })()}

          {/* Timeline & Station Risks toggle (Mobile & Tablet) */}
          <button
            onClick={() => setMobileRightOpen(!mobileRightOpen)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-bg-sunken border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-all duration-150 outline-none cursor-pointer shrink-0 active:scale-95"
            title="Toggle Stations & Live Trains"
            aria-label="Toggle Stations & Live Trains"
          >
            <List className="w-4 h-4" />
          </button>

          {/* Help Button */}
          <button
            onClick={() => setShowHelp(true)}
            className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center rounded-lg bg-bg-sunken border border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-default transition-all duration-150 outline-none cursor-pointer shrink-0 active:scale-95"
            title="Keyboard shortcuts & help"
          >
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-bg-sunken border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-all duration-150 outline-none cursor-pointer shrink-0 active:scale-95"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-bg-sunken border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-all duration-150 outline-none cursor-pointer shrink-0 active:scale-95"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center rounded-lg bg-bg-sunken border border-border-subtle hover:border-border-default transition-all duration-150 outline-none cursor-pointer shrink-0 active:scale-95"
            title={audioEnabled ? 'Mute alerts' : 'Enable audio alerts'}
          >
            {audioEnabled ? (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-green" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' }} />
            ) : (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-tertiary" />
            )}
          </button>

          {/* System Status Badge */}
          <div
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-accent-green text-[10px] sm:text-[11px] font-mono font-semibold shrink-0"
            style={{
              background: 'rgba(34,197,94,0.07)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-accent-green" style={{ boxShadow: '0 0 5px rgba(34,197,94,0.7)' }} />
            </span>
            <span className="hidden md:inline">Operational</span>
          </div>
        </div>
      </header>

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
};
