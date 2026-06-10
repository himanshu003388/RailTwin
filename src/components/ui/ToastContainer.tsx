import React, { useEffect, useState } from 'react';
import { useDemoStore, type Toast } from '../../stores/demoStore';
import { Info, AlertTriangle, AlertCircle, CheckCircle, Bot, X } from 'lucide-react';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState('100%');

  useEffect(() => {
    // Trigger progress bar shrink
    const progressTimer = setTimeout(() => {
      setProgress('0%');
    }, 50);

    // Auto dismiss after 5s
    const dismissTimer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000);

    return () => {
      clearTimeout(progressTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast.id, onDismiss]);

  // Style configurations based on Toast type
  const typeConfigs = {
    info: {
      border: '#3b82f6',
      icon: Info,
      color: '#3b82f6'
    },
    warning: {
      border: '#f59e0b',
      icon: AlertTriangle,
      color: '#f59e0b'
    },
    error: {
      border: '#ef4444',
      icon: AlertCircle,
      color: '#ef4444'
    },
    success: {
      border: '#22c55e',
      icon: CheckCircle,
      color: '#22c55e'
    },
    ai: {
      border: '#a855f7',
      icon: Bot,
      color: '#a855f7'
    }
  };

  const config = typeConfigs[toast.type] || typeConfigs.info;
  const Icon = config.icon;

  return (
    <div
      className="relative bg-[#111111] border border-[#222222] rounded-lg p-3 min-w-[288px] max-w-[340px] pointer-events-auto flex items-start gap-3 shadow-2xl animate-toast-slide select-none overflow-hidden"
      style={{ borderLeft: `4px solid ${config.border}` }}
    >
      {/* Left Icon */}
      <Icon className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" style={{ color: config.color }} />

      {/* Content */}
      <div className="flex-1 flex flex-col gap-0.5 pr-4">
        <span className="text-xs font-semibold text-white font-sans">
          {toast.title}
        </span>
        <span className="text-[10px] text-text-secondary leading-normal font-sans">
          {toast.message}
        </span>
      </div>

      {/* Dismiss X button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="absolute top-2 right-2 text-text-tertiary hover:text-white transition-colors duration-150 p-0.5 hover:bg-white/5 rounded outline-none"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Auto dismiss progress bar indicator */}
      <div
        className="absolute bottom-0 left-0 h-[2px]"
        style={{
          width: progress,
          backgroundColor: config.color,
          transition: 'width 5s linear'
        }}
      />
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useDemoStore(state => state.toasts);
  const removeToast = useDemoStore(state => state.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 p-4 max-w-full pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
};
