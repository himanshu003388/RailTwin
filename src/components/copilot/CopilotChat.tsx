import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Bot, Send, User } from 'lucide-react';

const CLIENT_TIMEOUT_MS = 65_000;

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
  const messages = copilot.messages;
  
  const [inputText, setInputText] = useState('');
  // Always starts as true — the server reads GEMINI_API_KEY from Vercel env
  const [isLiveActive, setIsLiveActive] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    const currentMessages = useDemoStore.getState().copilot.messages;
    if (!currentMessages.some(m => m.id === 'init-agent-msg')) {
      useDemoStore.setState(state => ({
        copilot: {
          ...state.copilot,
          messages: [
            {
              id: 'init-agent-msg',
              sender: 'copilot' as const,
              message: "Good morning. I'm monitoring the Delhi–Howrah corridor. All 8 stations operational, 5 trains on schedule. No active disruptions detected. Ask me anything about current operations.",
              timestamp: new Date()
            },
            ...state.copilot.messages.filter(m => m.id !== 'init-msg')
          ]
        }
      }));
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, copilot.thinking]);




  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg = { id: `user-msg-${Date.now()}`, sender: 'user' as const, message: text, timestamp: new Date() };
    const currentMessages = [...messages, userMsg];

    // Show user message and set thinking state
    useDemoStore.setState(state => ({
      copilot: {
        ...state.copilot,
        thinking: true,
        messages: currentMessages
      }
    }));

    const state = useDemoStore.getState();
    const systemState = {
      trains: state.trains,
      weatherAlert: state.weatherAlert,
      stationRisks: state.stationRisks,
      predictions: state.predictions,
      simulation: state.simulation,
      intervention: state.intervention,
      resolved: state.resolved,
      networkHealth: state.networkHealth
    };

    try {
      let replyMessage = '';

      // Always route through the server API — GEMINI_API_KEY is in Vercel environment, never sent from client
      const response = await fetchWithTimeout(`${getBaseUrl()}api/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          systemState
          // NOTE: userApiKey intentionally omitted — key lives server-side in Vercel env
        })
      });

      if (response.ok) {
        const data = await response.json();
        replyMessage = data.message;
        setIsLiveActive(true);
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned status ${response.status}`);
      }

      useDemoStore.setState(s => ({
        copilot: {
          ...s.copilot,
          thinking: false,
          messages: [...s.copilot.messages, { id: `copilot-msg-${Date.now()}`, sender: 'copilot' as const, message: replyMessage, timestamp: new Date() }]
        }
      }));

    } catch (err: any) {
      console.error('Error generating AI reply:', err);
      setIsLiveActive(false);

      let errorMsg: string;
      if (err.name === 'AbortError') {
        errorMsg = '⚠️ **Request Timed Out**\n\nThe Gemini model took too long to respond. This usually means high API load — please try again in a moment.';
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        errorMsg = '⚠️ **Connection Failed**\n\nCould not reach the AI server. The Vercel serverless function may be cold-starting or the GEMINI_API_KEY environment variable may not be set in your Vercel project settings.';
      } else {
        errorMsg = `⚠️ **AI Copilot Unavailable**\n\n${err.message || 'Could not reach the AI service.'}`;
      }

      useDemoStore.setState(s => ({
        copilot: {
          ...s.copilot,
          thinking: false,
          messages: [...s.copilot.messages, {
            id: `copilot-msg-${Date.now()}`,
            sender: 'copilot' as const,
            message: errorMsg,
            timestamp: new Date()
          }]
        }
      }));
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!inputText.trim() || copilot.thinking) return;
    handleSendMessage(inputText);
    setInputText('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const hasUserMessages = messages.some(m => m.sender === 'user');

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-bg-page text-text-primary">
      {/* Chat History */}
      <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
        {!hasUserMessages && (
          <div className="flex flex-col items-center justify-center py-8 select-none">
            <Bot className="w-10 h-10 text-border-default mb-3 animate-breath" />
            <span className="text-sm text-text-secondary font-medium mb-1">Ask about corridor status</span>
            <span className="text-xs text-text-tertiary max-w-[280px] text-center leading-relaxed mb-3">
              Ask queries about corridor trains, delays, weather impacts, cascade simulations, or general operations.
            </span>
            <div
              className="flex items-center gap-1.5 text-[10px] rounded-lg px-3 py-1.5"
              style={{
                background: isLiveActive ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${isLiveActive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                color: isLiveActive ? 'var(--color-accent-green)' : 'var(--color-accent-red)'
              }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? 'bg-accent-green animate-pulse' : 'bg-accent-red'}`} />
              <span>{isLiveActive ? 'Live AI Agent Mode (Gemini 2.5)' : 'AI Service Unavailable — Check Vercel Env'}</span>
            </div>
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
          <div className="flex flex-col gap-1 items-start max-w-[85%] self-start">
            <div className="flex items-center gap-1.5 ml-1 select-none">
              <Bot className="w-3.5 h-3.5 text-accent-purple" />
              <span className="text-xs font-semibold text-accent-purple">RailTwin Copilot</span>
            </div>
            <div
              className="rounded-lg rounded-tl-sm p-3"
              style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)' }}
            >
              <span className="text-xs text-accent-purple font-mono block mb-1.5 select-none">
                Analyzing corridor state...
              </span>
              <div className="flex gap-1 items-center h-2 pl-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple bounce-1 inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple bounce-2 inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple bounce-3 inline-block" />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border-default p-4 bg-bg-card animate-slide-up">
        {!hasUserMessages && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1.5 scrollbar-none select-none">
            {['Which station is most at risk?', "What's the cascade impact?", 'Recommended actions?'].map(q => (
              <button
                key={q}
                onClick={() => { setInputText(''); handleSendMessage(q); }}
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
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={copilot.thinking}
            placeholder={copilot.thinking ? "Analyzing corridor state..." : "Ask about corridor status..."}
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
          <span className={`w-1 h-1 rounded-full ${isLiveActive ? 'bg-accent-green animate-pulse' : 'bg-accent-red'}`} />
          <span className="text-[8px]">{isLiveActive ? 'LIVE ACTIVE' : 'SERVER UNAVAILABLE'}</span>
        </div>
      </div>
    </div>
  );
};
