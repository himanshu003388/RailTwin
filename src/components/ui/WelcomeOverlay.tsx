import React, { useState, useEffect } from 'react';
import { MapPin, BarChart3, Bot, Zap, ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'railtwin-welcome-seen';

const STEPS = [
  {
    icon: MapPin,
    title: 'Live Corridor Map',
    desc: 'See 5 trains moving across 7 stations. Colors show which stations are crowded or at risk of delays.',
  },
  {
    icon: Zap,
    title: 'Run the Demo',
    desc: 'Press "Run Demo" or hit SPACE to watch a 50-second scenario — monsoon rain causes delays and the system suggests fixes.',
  },
  {
    icon: BarChart3,
    title: 'Explore Panels',
    desc: 'Switch between 6 panels: Map, Delays, Disruptions, AI Chat, What-If, and Health. Press keys 1-6 to jump between them.',
  },
  {
    icon: Bot,
    title: 'AI Chat',
    desc: 'Ask AI Chat about the corridor, what is affected, or what to do next. It will recommend the best actions to take.',
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

  useEffect(() => {
    if (!visible) return;

    // Bug 9 fix: define handleKeyDown inside useEffect so it captures fresh step/visible
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
        if (step < STEPS.length - 1) {
          setStep(s => s + 1);
        } else {
          setExiting(true);
          localStorage.setItem(STORAGE_KEY, 'true');
          setTimeout(() => setVisible(false), 300);
        }
      } else if (e.key === 'Escape') {
        setExiting(true);
        localStorage.setItem(STORAGE_KEY, 'true');
        setTimeout(() => setVisible(false), 300);
      }
    };

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
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      }}
    >
      {/* Animated mesh gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none animate-mesh"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(37,99,235,0.20) 0%, rgba(168,85,247,0.12) 45%, transparent 80%)',
        }}
      />

      <div className={`relative w-full max-w-md mx-4 ${exiting ? '' : 'animate-slide-up'}`}>
        {/* Card — gradient border wrapper */}
        <div className="gradient-border rounded-2xl p-[1px]">
          <div
            className="rounded-2xl p-5 sm:p-8"
            style={{
              background: 'var(--color-bg-card)',
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition-colors duration-150 p-1 cursor-pointer"
              aria-label="Close welcome"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Branding pill */}
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs font-bold text-text-primary tracking-tight">RailTwin</span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
                style={{ background: 'rgba(168,85,247,0.12)', color: 'var(--color-accent-purple)', border: '1px solid rgba(168,85,247,0.25)' }}
              >
                AI
              </span>
              <div className="flex-1" />
              {/* Step indicator */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === step ? 'w-6 bg-accent-blue' : i < step ? 'w-2 bg-accent-blue/50' : 'w-2 bg-border-default'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Icon with glow ring */}
            <div className="relative w-14 h-14 mb-5">
              <div
                className="absolute inset-0 rounded-xl opacity-30 animate-breath"
                style={{
                  background: 'radial-gradient(circle, rgba(37,99,235,0.7), rgba(168,85,247,0.4), transparent)',
                  filter: 'blur(10px)',
                }}
              />
              <div
                className="relative w-14 h-14 rounded-xl flex items-center justify-center"
                style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-default)',
                  boxShadow: '0 0 0 3px rgba(37,99,235,0.08), 0 0 20px rgba(37,99,235,0.20)',
                }}
              >
                <Icon className="w-6 h-6 text-accent-blue" style={{ filter: 'drop-shadow(0 0 6px rgba(37,99,235,0.6))' }} />
              </div>
            </div>

            {/* Content */}
            <h2 className="text-xl font-bold text-text-primary mb-2 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              {current.title}
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-8">
              {current.desc}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleDismiss}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors duration-150 font-mono cursor-pointer"
              >
                Skip tour
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 active:scale-[0.98] cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent-blue) 0%, rgba(168,85,247,0.9) 100%)',
                  boxShadow: '0 0 20px rgba(37,99,235,0.4), 0 0 40px rgba(168,85,247,0.2)',
                }}
              >
                {step < STEPS.length - 1 ? 'Next' : 'Get Started'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
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
