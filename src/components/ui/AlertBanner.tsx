import React, { useEffect, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { X } from 'lucide-react';

export const AlertBanner: React.FC = () => {
  const weatherAlert = useDemoStore(state => state.weatherAlert);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState('100%');
  const [timeStr, setTimeStr] = useState('');

  // Handle auto-dismiss and progress transitions
  useEffect(() => {
    if (weatherAlert) {
      setVisible(true);
      setProgress('100%');

      // Set current alert time
      const formatted = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date());
      setTimeStr(formatted);

      // Trigger progress bar shrink
      const progressTimer = setTimeout(() => {
        setProgress('0%');
      }, 50);

      // Auto dismiss after 10s
      const dismissTimer = setTimeout(() => {
        setVisible(false);
      }, 10000);

      return () => {
        clearTimeout(progressTimer);
        clearTimeout(dismissTimer);
      };
    } else {
      setVisible(false);
    }
  }, [weatherAlert]);

  if (!visible || !weatherAlert) return null;

  return (
    <div className="fixed top-0 left-0 w-full bg-[#1a0000] border-b-2 border-accent-red z-[100] px-4 py-2.5 select-none shadow-lg animate-banner-down">
      <div className="flex items-center justify-between gap-3 max-w-[1400px] mx-auto relative">
        {/* Left Side: Pulse Dot & Message */}
        <div className="flex items-center gap-3">
          {/* Animated Pulse Circle */}
          <div className="relative w-3.5 h-3.5 flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-[#ef4444] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]"></span>
          </div>

          <p className="text-sm text-white flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-[#ef4444]">⚠ WEATHER ALERT</span>
            <span>—</span>
            <span>Heavy rainfall (72mm/hr) detected near Patna Junction. Delay predictions active.</span>
          </p>
        </div>

        {/* Right Side: Timestamp & Dismiss */}
        <div className="flex items-center gap-3 font-mono text-xs text-[#888] pl-2 flex-shrink-0">
          <span>{timeStr || '00:00:00'}</span>
          <button
            onClick={() => setVisible(false)}
            className="text-text-secondary hover:text-white transition-colors duration-150 p-1 hover:bg-white/5 rounded outline-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Auto dismiss progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2.5px] bg-[#ef4444]"
        style={{
          width: progress,
          transition: 'width 10s linear'
        }}
      />
    </div>
  );
};
