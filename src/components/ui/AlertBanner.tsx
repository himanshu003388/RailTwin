import React, { useEffect, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { X, CloudSun, CloudRain } from 'lucide-react';

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

  const stationMap: Record<string, string> = {
    ndls: 'New Delhi',
    cnb: 'Kanpur Central',
    ald: 'Prayagraj',
    pnbe: 'Patna Junction',
    hwh: 'Howrah Junction'
  };

  const getStationName = (code: string) => {
    return stationMap[code.toLowerCase()] || code.toUpperCase();
  };

  const alertMessage = weatherAlert.description.toLowerCase().includes('detected near')
    ? weatherAlert.description
    : `${weatherAlert.description.charAt(0).toUpperCase() + weatherAlert.description.slice(1)} detected near ${getStationName(weatherAlert.station)}`;

  const WeatherIcon = weatherAlert.rainfall > 0 ? CloudRain : CloudSun;

  return (
    <div
      className="fixed top-0 left-0 w-full z-[100] px-4 py-2.5 select-none shadow-lg animate-banner-down border-b-2"
      style={{
        background: 'color-mix(in srgb, var(--color-accent-red) 8%, var(--color-bg-card))',
        borderColor: 'var(--color-accent-red)',
      }}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3 max-w-[1400px] mx-auto relative">
        {/* Left Side: Pulse Dot & Message */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Animated Pulse Circle */}
          <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full opacity-75" style={{ backgroundColor: 'var(--color-accent-red)' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--color-accent-red)' }} />
          </div>

          <WeatherIcon className="w-4 h-4 text-accent-red shrink-0" />

          <p className="text-xs sm:text-sm text-text-primary flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0">
            <span className="font-bold whitespace-nowrap" style={{ color: 'var(--color-accent-red)' }}>⚠ WEATHER ALERT</span>
            <span className="text-text-secondary hidden sm:inline">—</span>
            <span className="text-text-primary truncate max-sm:text-[11px]">{alertMessage}. Delay predictions active.</span>
            <span className="text-text-tertiary text-[10px] sm:text-xs font-mono hidden sm:inline">
              {weatherAlert.temperature}°C | {weatherAlert.humidity}% RH | Wind {weatherAlert.windSpeed} km/h
            </span>
            <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-accent-blue-soft text-accent-blue border-accent-blue/30">
              LIVE OWM
            </span>
          </p>
        </div>

        {/* Right Side: Timestamp & Dismiss */}
        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] sm:text-xs text-text-tertiary pl-1 sm:pl-2 flex-shrink-0">
          <span className="hidden sm:inline">{timeStr || '00:00:00'}</span>
          <button
            onClick={() => setVisible(false)}
            className="text-text-secondary hover:text-text-primary transition-colors duration-150 p-1 hover:bg-bg-hover rounded outline-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Auto dismiss progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2.5px]"
        style={{
          width: progress,
          backgroundColor: 'var(--color-accent-red)',
          transition: 'width 10s linear'
        }}
      />
    </div>
  );
};
