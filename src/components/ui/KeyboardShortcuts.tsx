import React, { useEffect } from 'react';
import { useDemoStore } from '../../stores/demoStore';

export const KeyboardShortcuts: React.FC = () => {
  const setActivePanel = useDemoStore(state => state.setActivePanel);
  const startDemo = useDemoStore(state => state.startDemo);
  const resetDemo = useDemoStore(state => state.resetDemo);
  const pauseDemo = useDemoStore(state => state.pauseDemo);
  const resumeDemo = useDemoStore(state => state.resumeDemo);
  const toggleAudio = useDemoStore(state => state.toggleAudio);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      )) {
        return;
      }

      switch (e.key) {
        // Panel switching: 1-6
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

        // Demo controls
        case ' ': // Space
          e.preventDefault();
          const state = useDemoStore.getState();
          if (!state.demoRunning) {
            startDemo();
          } else if (state.isPaused) {
            resumeDemo();
          } else {
            pauseDemo();
          }
          break;

        case 'r':
        case 'R':
          e.preventDefault();
          resetDemo();
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
  }, [setActivePanel, startDemo, resetDemo, pauseDemo, resumeDemo, toggleAudio]);

  return null;
};
