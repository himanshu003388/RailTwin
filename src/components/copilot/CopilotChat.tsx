import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Bot, Send, User } from 'lucide-react';

const CLIENT_TIMEOUT_MS = 25_000;

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = CLIENT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getBaseUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export const CopilotChat: React.FC = () => {
  const copilot = useDemoStore(state => state.copilot);
  const geminiApiKey = useDemoStore(state => state.geminiApiKey);
  const messages = copilot.messages;
  
  const [inputText, setInputText] = useState('');
  // Always starts as true — the server reads GEMINI_API_KEY from Vercel env
  const [isLiveActive, setIsLiveActive] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const active = isLiveActive || !!geminiApiKey;

  async function askGemini(userMessage: string, simulationState: object): Promise<string> {
    try {
      const response = await fetchWithTimeout(`${getBaseUrl()}api/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          simulationState,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errData.error || 'Unknown error'}`);
      }
      const data = await response.json();
      return data.reply ?? 'Unable to get response.';
    } catch (err) {
      const msg = String(err);
      if (msg.includes('AbortError') || msg.includes('aborted')) {
        return 'AI request timed out. The server may be under load — please try again.';
      }
      if (msg.includes('429')) {
        return 'AI service is temporarily rate-limited. Please wait a moment and try again. If this persists, configure your own Gemini API key in Settings to avoid shared rate limits.';
      }
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('TypeError')) {
        return 'Network error — unable to reach the AI service. Please check your connection and try again.';
      }
      return 'AI service request failed. Please try again.';
    }
  }

  // Verify that the server has GEMINI_API_KEY configured in Vercel env
  useEffect(() => {
    const checkBackendKey = async () => {
      try {
        const res = await fetchWithTimeout(`${getBaseUrl()}api/copilot/chat`);
        if (res.ok) {
          const data = await res.json();
          setIsLiveActive(!!data.hasKey);
        } else {
          setIsLiveActive(false);
        }
      } catch (e) {
        console.warn('Could not verify backend API key status', e);
        setIsLiveActive(false);
      }
    };

    checkBackendKey();
  }, []);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, copilot.thinking]);




  const handleSend = async (overrideText?: string) => {
    const text = overrideText ?? inputText;
    if (!text.trim()) return;
    const userMsg = text.trim();
    setInputText('');

    const userMsgObj = { id: `user-msg-${Date.now()}`, sender: 'user' as const, message: userMsg, timestamp: new Date() };

    useDemoStore.setState(state => ({
      copilot: {
        ...state.copilot,
        thinking: true,
        messages: [...state.copilot.messages, userMsgObj]
      }
    }));

    const state = useDemoStore.getState();
    const simulationState = {
      activeTrains: state.trains?.length ?? 5,
      stationsAtRisk: state.stations?.filter(s => s.riskLevel && s.riskLevel !== 'low').length ?? 0,
      totalDelay: state.trains?.reduce((sum, t) => sum + (t.predictedDelay || 0), 0) ?? 0,
      passengersAffected: state.simulation?.passengersAffected ?? 0,
      currentEvents: state.predictions?.map(p => `Train ${p.trainId} delayed +${p.delayMinutes}m at ${p.affectedStation.toUpperCase()}`).join(', ') || 'None',
      weather: state.weatherAlert?.description ?? 'Clear',
      networkEfficiency: state.networkHealth?.efficiency ?? 100,
    };

    const reply = await askGemini(userMsg, simulationState);

    setIsLiveActive(true);

    useDemoStore.setState(s => ({
      copilot: {
        ...s.copilot,
        thinking: false,
        messages: [...s.copilot.messages, { id: `copilot-msg-${Date.now()}`, sender: 'copilot' as const, message: reply, timestamp: new Date() }]
      }
    }));
  };

  const inputRef = useRef<HTMLInputElement>(null);

  const prevThinking = useRef(copilot.thinking);
  useEffect(() => {
    if (prevThinking.current && !copilot.thinking) {
      inputRef.current?.focus();
    }
    prevThinking.current = copilot.thinking;
  }, [copilot.thinking]);

  const handleSubmit = () => {
    if (!inputText.trim() || copilot.thinking) return;
    handleSend();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleFormSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit();
  };

  const hasUserMessages = messages.some(m => m.sender === 'user');
  const hasCopilotMessages = messages.some(m => m.sender === 'copilot');
  const showEmptyState = !hasUserMessages && !hasCopilotMessages;

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary">
      {/* Chat History */}
      <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
        {showEmptyState && (
          <div className="flex flex-col items-center justify-center py-8 select-none">
            <Bot className="w-10 h-10 text-border-default mb-3 animate-breath" />
            <span className="text-sm text-text-secondary font-medium mb-1">Ask about corridor status</span>
            <span className="text-xs text-text-tertiary max-w-[280px] text-center leading-relaxed mb-3">
              Ask queries about corridor trains, delays, weather impacts, cascade simulations, or general operations.
            </span>
            <div
              className="flex items-center gap-1.5 text-[10px] rounded-lg px-3 py-1.5"
              style={{
                background: active ? 'var(--color-risk-low-bg)' : 'var(--color-risk-critical-bg)',
                border: `1px solid ${active ? 'var(--color-risk-low-border)' : 'var(--color-risk-critical-border)'}`,
                color: active ? 'var(--color-risk-low)' : 'var(--color-risk-critical)'
              }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-risk-low animate-pulse' : 'bg-risk-critical'}`} />
              <span>{active ? 'Live AI Agent Mode' : 'AI Service Unavailable · Configure Settings'}</span>
            </div>
            {!active && (
              <div className="mt-4 p-3.5 rounded-lg border border-border-default bg-bg-card max-w-[320px] text-center flex flex-col gap-2 shadow-sm">
                <span className="text-[11px] font-semibold text-text-primary">Gemini API Key Required</span>
                <span className="text-[10px] text-text-tertiary leading-relaxed">
                  Please open **Settings** (gear icon in the top right) and enter a valid Gemini API Key to enable real-time operational query answering.
                </span>
              </div>
            )}
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          const isSystem = msg.sender === 'system';
          const timeLabel = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(msg.timestamp);

          if (isSystem) return (
            <div key={msg.id} className="text-center font-mono text-[10px] text-text-muted py-1 select-none">
              {msg.message} — {timeLabel}
            </div>
          );

          if (isUser) return (
            <div key={msg.id} className="flex flex-col gap-1 items-end max-w-[80%] self-end">
              <div className="flex items-center gap-1.5 mr-1 select-none">
                <User className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-xs font-semibold text-text-secondary">Operator</span>
              </div>
              <div
                className="rounded-lg rounded-tr-sm p-3 text-sm text-text-primary select-text leading-relaxed"
                style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-hover)' }}
              >
                {msg.message}
              </div>
            </div>
          );

          return (
            <div key={msg.id} className="flex flex-col gap-1 items-start max-w-[85%] self-start">
              <div className="flex items-center gap-1.5 ml-1 select-none">
                <Bot className="w-3.5 h-3.5 text-accent-purple" />
                <span className="text-xs font-semibold text-accent-purple">RailTwin Copilot</span>
                <span className="text-[10px] text-text-muted font-mono">{timeLabel}</span>
              </div>
              <div
                className="rounded-lg rounded-tl-sm p-3 text-sm text-text-primary select-text leading-relaxed w-full"
                style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)' }}
              >
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}

        {copilot.thinking && (
          <div className="flex items-center gap-2 text-sm text-gray-400 px-3 py-2">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-100">●</span>
            <span className="animate-pulse delay-200">●</span>
            <span className="ml-1 text-xs">RailTwin AI thinking...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border-default p-4 bg-bg-card animate-slide-up">
        {showEmptyState && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1.5 scrollbar-none select-none">
            {['Which station is most at risk?', "What's the cascade impact?", 'Recommended actions?'].map(q => (
              <button
                key={q}
                onClick={() => { setInputText(''); handleSend(q); }}
                disabled={copilot.thinking}
                className="text-xs rounded-full px-3 py-1.5 transition-all duration-150 whitespace-nowrap outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-tertiary)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="flex gap-2 items-center relative">
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={copilot.thinking}
            placeholder={copilot.thinking ? "Analyzing corridor state…" : "Ask about corridor status…"}
            className="flex-grow rounded-lg text-sm px-3.5 py-2 outline-none transition-colors duration-200 pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={e  => (e.currentTarget.style.borderColor = 'var(--color-accent-purple)')}
            onBlur={e   => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
          />
          <button
            type="submit"
            disabled={copilot.thinking || !inputText.trim()}
            className="absolute right-1.5 text-white p-1.5 rounded-md transition-all duration-200 outline-none active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
            style={{ background: 'var(--color-accent-purple)', boxShadow: '0 0 8px rgba(168,85,247,0.4)' }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-2.5 text-[9px] text-text-muted text-center font-mono select-none uppercase tracking-wider flex items-center justify-center gap-1.5">
          <span>RailTwin Copilot · Powered by Gemini Agent API</span>
          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-risk-low animate-pulse' : 'bg-risk-critical'}`} />
          <span className="text-[8px]">{active ? 'LIVE ACTIVE' : 'SERVER UNAVAILABLE'}</span>
        </div>
      </div>
    </div>
  );
};
