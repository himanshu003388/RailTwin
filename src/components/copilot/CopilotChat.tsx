import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Bot, Send, User } from 'lucide-react';

function getBaseUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export const CopilotChat: React.FC = () => {
  const copilot = useDemoStore(state => state.copilot);
  const geminiApiKey = useDemoStore(state => state.geminiApiKey);
  const messages = copilot.messages;
  
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function sendMessage(msgs: { role: string; text: string }[]): Promise<string> {
    try {
      const res = await fetch(`${getBaseUrl()}api/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          userApiKey: geminiApiKey || undefined,
        }),
      });
      const data = await res.json();
      // chat.ts returns { reply } field; standardize retrieval
      const text = data.reply ?? data.message ?? null;
      if (res.status === 429) {
        return text ?? 'The AI service has hit its rate limit. Please wait a moment and try again.';
      }
      if (!res.ok) {
        throw new Error(data.detail ?? data.error ?? 'chat failed');
      }
      if (!text) throw new Error('Empty AI response');
      return text;
    } catch (err: any) {
      throw new Error(err?.message ?? 'Failed to reach the AI service. Check your API key in Settings.');
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, copilot.thinking]);




  const handleSend = async (overrideText?: string) => {
    const text = overrideText ?? inputText;
    if (!text.trim()) return;
    const userMsg = text.trim();
    setInputText('');

    useDemoStore.setState(state => ({
      copilot: {
        ...state.copilot,
        thinking: true,
        messages: [...state.copilot.messages, { id: `user-msg-${Date.now()}`, sender: 'user' as const, message: userMsg, timestamp: new Date() }]
      }
    }));

    const history = [
      ...messages.map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'model' as const,
        text: m.message,
      })),
      { role: 'user' as const, text: userMsg },
    ];

    try {
      const reply = await sendMessage(history);
      useDemoStore.setState(s => ({
        copilot: {
          ...s.copilot,
          thinking: false,
          messages: [...s.copilot.messages, { id: `copilot-msg-${Date.now()}`, sender: 'copilot' as const, message: reply, timestamp: new Date() }]
        }
      }));
    } catch (err: any) {
      useDemoStore.setState(s => ({
        copilot: {
          ...s.copilot,
          thinking: false,
          messages: [...s.copilot.messages, {
            id: `copilot-err-${Date.now()}`,
            sender: 'copilot' as const,
            message: err?.message ?? 'An unexpected error occurred. Please try again.',
            timestamp: new Date()
          }]
        }
      }));
    }
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
            <span className="text-sm text-text-secondary font-medium mb-1">Ask about the corridor</span>
            <span className="text-xs text-text-tertiary max-w-[280px] text-center leading-relaxed mb-3">
              Ask about trains, delays, weather, or anything happening on the corridor.
            </span>
            <div
              className="flex items-center gap-1.5 text-[10px] rounded-lg px-3 py-1.5"
              style={{
                background: 'var(--color-risk-low-bg)',
                border: '1px solid var(--color-risk-low-border)',
                color: 'var(--color-risk-low)'
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-risk-low animate-pulse" />
              <span>AI Active</span>
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
                <span className="text-xs font-semibold text-text-secondary">You</span>
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
                <span className="text-xs font-semibold text-accent-purple">AI Chat</span>
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
          <div className="flex items-center gap-3 self-start max-w-[85%]">
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-lg rounded-tl-sm"
              style={{
                background: 'rgba(168,85,247,0.06)',
                border: '1px solid rgba(168,85,247,0.25)',
              }}
            >
              <Bot className="w-3.5 h-3.5 text-accent-purple shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple ai-dot-1" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple ai-dot-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple ai-dot-3" />
              </div>
              <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Analyzing…</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border-default p-4 bg-bg-card animate-slide-up">
        {showEmptyState && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1.5 scrollbar-none select-none">
            {['Which station is most at risk?', 'What is the impact so far?', 'Recommended actions?'].map(q => (
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
            placeholder={copilot.thinking ? "Analyzing…" : "Ask about the corridor…"}
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
          <span>AI Chat</span>
          <span className="w-1.5 h-1.5 rounded-full bg-risk-low animate-pulse" />
          <span className="text-[8px]">ACTIVE</span>
        </div>
      </div>
    </div>
  );
};
