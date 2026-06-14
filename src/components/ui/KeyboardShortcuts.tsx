import React, { useEffect } from 'react';
import { useDemoStore } from '../../stores/demoStore';

export const KeyboardShortcuts: React.FC = () => {
  const setActivePanel = useDemoStore(state => state.setActivePanel);
  const toggleAudio = useDemoStore(state => state.toggleAudio);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      )) {
        return;
      }

      switch (e.key) {
        case '1':
          e.preventDefault();
          setActivePanel('map');
          break;
        case '2':
          e.preventDefault();
          setActivePanel('delays');
          break;
        case '3':
          e.preventDefault();
          setActivePanel('simulation');
          break;
        case '4':
          e.preventDefault();
          setActivePanel('copilot');
          break;
        case '5':
          e.preventDefault();
          setActivePanel('whatif');
          break;
        case '6':
          e.preventDefault();
          setActivePanel('health');
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleAudio();
          break;
        case 'Escape':
          e.preventDefault();
          setActivePanel('map');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActivePanel, toggleAudio]);

  return null;
};
