import React, { useEffect, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Shield, ShieldAlert, Users, Compass, Clock, Volume2, VolumeX, HelpCircle } from 'lucide-react';
import { HelpModal } from '../ui/HelpModal';

export const TopBar: React.FC = () => {
  const demoRunning = useDemoStore(state => state.demoRunning);
  const audioEnabled = useDemoStore(state => state.audioEnabled);
  const toggleAudio = useDemoStore(state => state.toggleAudio);
  const [timeStr, setTimeStr] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const formatted = new Intl.DateTimeFormat('en-US', options).format(new Date());
      setTimeStr(`${formatted} IST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
    <header className="h-12 bg-bg-card border-b border-border-default px-4 flex items-center justify-between text-sm select-none shrink-0">
      {/* Breadcrumb Left */}
      <div className="flex items-center gap-2 text-text-secondary font-mono text-[11px] uppercase tracking-wider">
        <span className="text-text-tertiary">Operations Center</span>
        <span className="text-text-tertiary">/</span>
        <span className="text-text-primary font-medium">Delhi–Howrah</span>
      </div>

      {/* Center Stat Pills */}
      <div className="flex items-center gap-3">
        {/* Pass Count */}
        <div className="flex items-center gap-1.5 bg-bg-elevated border border-border-default px-2 py-0.5 rounded text-text-secondary text-xs">
          <Users className="w-3.5 h-3.5 text-text-tertiary" />
          <span>23M daily passengers</span>
        </div>

        {/* Corridor Length */}
        <div className="flex items-center gap-1.5 bg-bg-elevated border border-border-default px-2 py-0.5 rounded text-text-secondary text-xs">
          <Compass className="w-3.5 h-3.5 text-text-tertiary" />
          <span>1,531 km corridor</span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-1.5 bg-bg-elevated border border-border-default px-2 py-0.5 rounded text-text-primary text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-accent-blue" />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{timeStr || '00:00:00 IST'}</span>
        </div>
      </div>

      {/* Right status indicator */}
      <div className="flex items-center gap-2">
        {/* Help Button */}
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1 bg-bg-elevated border border-border-default px-2 py-0.5 rounded text-xs transition-colors duration-150 outline-none hover:border-border-hover"
          title="Keyboard shortcuts & help"
        >
          <HelpCircle className="w-3.5 h-3.5 text-text-tertiary" />
        </button>

        {/* Audio Toggle */}
        <button
          onClick={toggleAudio}
          className="flex items-center gap-1 bg-bg-elevated border border-border-default px-2 py-0.5 rounded text-xs transition-colors duration-150 outline-none hover:border-border-hover"
          title={audioEnabled ? 'Mute alerts' : 'Enable audio alerts'}
        >
          {audioEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-accent-green" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-text-tertiary" />
          )}
        </button>

        {demoRunning ? (
          <div className="flex items-center gap-1.5 bg-[#f59e0b]/5 border border-[#f59e0b]/20 px-2 py-0.5 rounded text-accent-amber text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-amber opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-amber"></span>
            </span>
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Demo Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-[#22c55e]/5 border border-[#22c55e]/20 px-2 py-0.5 rounded text-accent-green text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
            </span>
            <Shield className="w-3.5 h-3.5" />
            <span>Systems Nominal</span>
          </div>
        )}
      </div>
    </header>
    <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
};
