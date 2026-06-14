import React, { useState, useEffect } from 'react';
import { MapPin, BarChart3, Bot, Zap, ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'railtwin-welcome-seen';

const STEPS = [
  {
    icon: MapPin,
    title: 'Live Corridor Map',
    desc: 'Track 5 trains across 7 stations on the Delhi-Howrah corridor. Color-coded risk levels show crowd density and delay risk in real-time.',
  },
  {
    icon: Zap,
    title: 'Run the Demo',
    desc: 'Press the "Run Demo Scenario" button or hit SPACE to start a 50-second simulation of monsoon disruption, cascading delays, and AI mitigation.',
  },
  {
    icon: BarChart3,
    title: 'Explore Panels',
    desc: 'Switch between 6 views: Map, Train Delays, Simulation, AI Chat, What-If Lab, and System Health. Use keys 1-6 for quick access.',
  },
  {
    icon: Bot,
    title: 'AI Chat',
    desc: 'Ask AI Chat about corridor status, cascade impacts, or recommended actions. It analyzes disruptions and suggests mitigations.',
  },
];

export const WelcomeOverlay: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setExiting(true);
    localStorage.setItem(STORAGE_KEY, 'true');
    setTimeout(() => setVisible(false), 300);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable
    )) {
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'Escape') {
      handleDismiss();
    }
  };

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, visible]);

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div className="relative w-full max-w-md mx-4">
        {/* Card */}
        <div className="bg-bg-card border border-border-default rounded-2xl p-5 sm:p-8 shadow-2xl">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition-colors duration-150 p-1"
            aria-label="Close welcome"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-accent-blue' : i < step ? 'w-2 bg-accent-blue/50' : 'w-2 bg-border-default'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border-default flex items-center justify-center mb-5">
            <Icon className="w-6 h-6 text-accent-blue" />
          </div>

          {/* Content */}
          <h2 className="text-lg font-semibold text-text-primary mb-2 tracking-tight">
            {current.title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-8">
            {current.desc}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleDismiss}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors duration-150 font-mono"
            >
              Skip tour
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-accent-blue hover:opacity-90 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-150 active:scale-[0.98]"
            >
              {step < STEPS.length - 1 ? 'Next' : 'Get Started'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="text-center mt-3 text-[10px] text-text-tertiary font-mono">
          Press <kbd className="px-1 py-0.5 bg-bg-elevated border border-border-default rounded text-text-secondary">Enter</kbd> to continue · <kbd className="px-1 py-0.5 bg-bg-elevated border border-border-default rounded text-text-secondary">Esc</kbd> to skip
        </div>
      </div>
    </div>
  );
};
