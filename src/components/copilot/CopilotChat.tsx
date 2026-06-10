import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Bot, Send, User, Info } from 'lucide-react';

interface ReasoningTraceProps { trace: string; }

const ReasoningTrace: React.FC<ReasoningTraceProps> = ({ trace }) => {
  const lines = trace.split('\n');
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    const interval = setInterval(() => {
      setVisibleCount(prev => {
        if (prev < lines.length) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [trace]);

  return (
    <div
      className="rounded-r-lg p-2.5 font-mono text-[10px] whitespace-pre-wrap mt-2 flex flex-col gap-1 w-full select-text"
      style={{
        background: 'var(--color-bg-page)',
        borderLeft: '2px solid var(--color-accent-purple)',
        color: 'var(--color-text-secondary)',
      }}
    >
      {lines.slice(0, visibleCount).map((line, idx) => (
        <div key={idx}>{line}</div>
      ))}
    </div>
  );
};

export const CopilotChat: React.FC = () => {
  const copilot   = useDemoStore(state => state.copilot);
  const messages  = copilot.messages;
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const presetReplies: Record<string, string> = {
    'Which station is most at risk?': 'Currently, Patna Junction (PNBE) is most at risk due to heavy localized monsoon rainfall (72mm/hr), causing platform congestion and potential platform conflicts.',
    "What's the cascade impact?": 'Heavy rains at Patna Junction are causing a cascade delay. Train 12301 is delayed by 38 mins, and Train 12303 is delayed by 22 mins. This triggers 3 platform conflicts, impacting Patna, Dhanbad, and Howrah with a total cascade delay of 52 minutes.',
    'Recommended actions?': 'I recommend:\n1. Issue an 18-minute hold order for Train 12303 at Allahabad Junction to resolve the platform conflict.\n2. Deploy crowd management at Patna platform 5 & 7.\n3. Push passenger alerts via NTES for Train 12301.'
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    useDemoStore.setState(state => ({
      copilot: { ...state.copilot, thinking: true, messages: [...state.copilot.messages, { id: `user-msg-${Date.now()}`, sender: 'user' as const, message: text, timestamp: new Date() }] }
    }));
    setTimeout(() => {
      useDemoStore.setState(state => ({
        copilot: {
          ...state.copilot,
          thinking: false,
          messages: [...state.copilot.messages, { id: `copilot-msg-${Date.now()}`, sender: 'copilot' as const, message: presetReplies[text] || "I am analyzing the corridor telemetry. Please let me know if you would like details on delay predictions or platform conflicts.", timestamp: new Date() }]
        }
      }));
    }, 800);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendMessage(inputText);
    setInputText('');
  };

  const hasUserMessages = messages.some(m => m.sender === 'user');

  const reasoningText = `[AGENT] Risk threshold breached: 12301 predicted +38min at PNBE
[TOOL] run_simulation({"train":"12301","delay":38})
[RESULT] 3 platform conflicts · PNBE crowd → CRITICAL · +52min cascade
[TOOL] query_train_schedule("12303")
[RESULT] 12303 has 25min buffer at ALD → can absorb 18min hold
[REASONING] Hold at ALD resolves conflict without further cascade`;

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-bg-page text-text-primary">
      {/* Chat History */}
      <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
        {!hasUserMessages && (
          <div className="flex flex-col items-center justify-center py-8 select-none">
            <Bot className="w-10 h-10 text-border-default mb-3" />
            <span className="text-sm text-text-secondary font-medium mb-1">Ask about corridor status</span>
            <span className="text-xs text-text-tertiary max-w-[280px] text-center leading-relaxed mb-3">
              Use the preset questions below or type your own query about the Delhi-Howrah corridor
            </span>
            <div
              className="flex items-center gap-1.5 text-[10px] rounded-lg px-3 py-1.5"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-tertiary)' }}
            >
              <Info className="w-3 h-3" />
              <span>Demo responses — not live AI</span>
            </div>
          </div>
        )}

        {messages.map(msg => {
          const isCopilot = msg.sender === 'copilot';
          const isSystem  = msg.sender === 'system';
          const isUser    = msg.sender === 'user';
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

          const isRecMessage = msg.id.startsWith('cop-rec-');
          return (
            <div key={msg.id} className="flex flex-col gap-1 items-start max-w-[85%] self-start">
              <div className="flex items-center gap-1.5 ml-1 select-none">
                <Bot className="w-3.5 h-3.5 text-accent-purple" />
                <span className="text-xs font-semibold text-accent-purple">RailTwin Copilot</span>
                <span className="text-[10px] text-text-muted font-mono">{timeLabel}</span>
              </div>
              <div
                className="rounded-lg rounded-tl-sm p-3 text-sm text-text-primary select-text leading-relaxed"
                style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)' }}
              >
                {msg.message}
                {isRecMessage && <ReasoningTrace trace={reasoningText} />}
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
      <div className="border-t border-border-default p-4 bg-bg-card">
        {!hasUserMessages && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1.5 scrollbar-none select-none">
            {['Which station is most at risk?', "What's the cascade impact?", 'Recommended actions?'].map(q => (
              <button
                key={q}
                onClick={() => handleSendMessage(q)}
                className="text-xs rounded-full px-3 py-1.5 transition-all duration-150 whitespace-nowrap outline-none"
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
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Ask about corridor status..."
            className="flex-grow rounded-lg text-sm px-3.5 py-2 outline-none transition-colors duration-200 pr-10"
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
            className="absolute right-1.5 text-white p-1.5 rounded-md transition-colors duration-200 outline-none active:scale-95"
            style={{ background: 'var(--color-accent-purple)', boxShadow: '0 0 8px rgba(168,85,247,0.4)' }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-2.5 text-[9px] text-text-muted text-center font-mono select-none uppercase tracking-wider">
          RailTwin Copilot · Powered by LangGraph + Gemini
        </div>
      </div>
    </div>
  );
};
