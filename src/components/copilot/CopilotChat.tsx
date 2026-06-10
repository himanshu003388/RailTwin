import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Bot, Send, User } from 'lucide-react';

// Subcomponent to typewriter reasoning traces line-by-line
interface ReasoningTraceProps {
  trace: string;
}

const ReasoningTrace: React.FC<ReasoningTraceProps> = ({ trace }) => {
  const lines = trace.split('\n');
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    const interval = setInterval(() => {
      setVisibleCount(prev => {
        if (prev < lines.length) {
          return prev + 1;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 80);

    return () => clearInterval(interval);
  }, [trace]);

  return (
    <div className="bg-[#0a0a0a] border-l-2 border-[#a855f7] p-2.5 rounded-r-lg font-mono text-[10px] text-[#888888] whitespace-pre-wrap mt-2 flex flex-col gap-1 w-full select-text selection:bg-[#a855f7]/30 selection:text-white">
      {lines.slice(0, visibleCount).map((line, idx) => (
        <div key={idx}>{line}</div>
      ))}
    </div>
  );
};

export const CopilotChat: React.FC = () => {
  const copilot = useDemoStore(state => state.copilot);
  const messages = copilot.messages;
  const [inputText, setInputText] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Pre-populate initial agent message on mount
  useEffect(() => {
    const currentMessages = useDemoStore.getState().copilot.messages;
    const hasInit = currentMessages.some(m => m.id === 'init-agent-msg');

    if (!hasInit) {
      const initAgentMsg = {
        id: 'init-agent-msg',
        sender: 'copilot' as const,
        message: "Good morning. I'm monitoring the Delhi–Howrah corridor. All 8 stations operational, 5 trains on schedule. No active disruptions detected. Ask me anything about current operations.",
        timestamp: new Date()
      };

      useDemoStore.setState(state => ({
        copilot: {
          ...state.copilot,
          // Replace initial system log with friendly agent prompt
          messages: [initAgentMsg, ...state.copilot.messages.filter(m => m.id !== 'init-msg')]
        }
      }));
    }
  }, []);

  // Auto scroll to bottom
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

    // Send user message
    const userMsg = {
      id: `user-msg-${Date.now()}`,
      sender: 'user' as const,
      message: text,
      timestamp: new Date()
    };

    useDemoStore.setState(state => ({
      copilot: {
        ...state.copilot,
        thinking: true,
        messages: [...state.copilot.messages, userMsg]
      }
    }));

    // Trigger copilot response after delay
    setTimeout(() => {
      const reply = presetReplies[text] || "I am analyzing the corridor telemetry. Please let me know if you would like me to compile details on train delay predictions or station platform conflicts.";
      const copilotMsg = {
        id: `copilot-msg-${Date.now()}`,
        sender: 'copilot' as const,
        message: reply,
        timestamp: new Date()
      };

      useDemoStore.setState(state => ({
        copilot: {
          ...state.copilot,
          thinking: false,
          messages: [...state.copilot.messages, copilotMsg]
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

  // Preset Questions check: show them when there's no custom user messages yet
  const hasUserMessages = messages.some(m => m.sender === 'user');

  // Hardcoded reasoning text triggered when recommended message is sent
  const reasoningText = `[AGENT] Risk threshold breached: 12301 predicted +38min at PNBE
[TOOL] run_simulation({"train":"12301","delay":38})
[RESULT] 3 platform conflicts · PNBE crowd → CRITICAL · +52min cascade
[TOOL] query_train_schedule("12303")
[RESULT] 12303 has 25min buffer at ALD → can absorb 18min hold
[REASONING] Hold at ALD resolves conflict without further cascade`;

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-[#0a0a0a] text-white">
      {/* Dynamic animations for staggered bouncing dots */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce-dot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .bounce-1 { animation: bounce-dot 0.6s infinite 0.1s; }
        .bounce-2 { animation: bounce-dot 0.6s infinite 0.2s; }
        .bounce-3 { animation: bounce-dot 0.6s infinite 0.3s; }
      ` }} />

      {/* Chat History Container */}
      <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
        {!hasUserMessages && (
          <div className="flex flex-col items-center justify-center py-8 text-[#555] select-none">
            <Bot className="w-8 h-8 text-[#222] mb-2 animate-breath" />
            <span className="font-mono text-xs">Ask me anything about the corridor</span>
          </div>
        )}

        {messages.map(msg => {
          const isCopilot = msg.sender === 'copilot';
          const isSystem = msg.sender === 'system';
          const isUser = msg.sender === 'user';
          
          // Timestamp formatting
          const timeLabel = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).format(msg.timestamp);

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center font-mono text-[10px] text-[#444] py-1 select-none">
                {msg.message} — {timeLabel}
              </div>
            );
          }

          if (isUser) {
            return (
              <div key={msg.id} className="flex flex-col gap-1 items-end max-w-[80%] self-end">
                <div className="flex items-center gap-1.5 mr-1 select-none">
                  <User className="w-3.5 h-3.5 text-text-secondary" />
                  <span className="text-xs font-semibold text-text-secondary">Operator</span>
                </div>
                <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg rounded-tr-sm p-3 text-sm text-white select-text selection:bg-[#3b82f6]/30 selection:text-white leading-relaxed">
                  {msg.message}
                </div>
              </div>
            );
          }

          // Trigger reasoning trace overlay on recommendation events
          const isRecMessage = msg.id.startsWith('cop-rec-');

          return (
            <div key={msg.id} className="flex flex-col gap-1 items-start max-w-[85%] self-start">
              <div className="flex items-center gap-1.5 ml-1 select-none">
                <Bot className="w-3.5 h-3.5 text-[#a855f7]" />
                <span className="text-xs font-semibold text-[#a855f7]">RailTwin Copilot</span>
                <span className="text-[10px] text-[#444] font-mono">{timeLabel}</span>
              </div>
              <div className="bg-[#0f0a1a] border border-[#2d1b6b] rounded-lg rounded-tl-sm p-3 text-sm text-white select-text selection:bg-[#a855f7]/30 selection:text-white leading-relaxed">
                {msg.message}
                {isRecMessage && <ReasoningTrace trace={reasoningText} />}
              </div>
            </div>
          );
        })}

        {/* Animated Thinking bubble */}
        {copilot.thinking && (
          <div className="flex flex-col gap-1 items-start max-w-[85%] self-start animate-pulse">
            <div className="flex items-center gap-1.5 ml-1 select-none">
              <Bot className="w-3.5 h-3.5 text-[#a855f7]" />
              <span className="text-xs font-semibold text-[#a855f7]">RailTwin Copilot</span>
            </div>
            <div className="bg-[#0f0a1a] border border-[#2d1b6b] rounded-lg rounded-tl-sm p-3">
              <span className="text-xs text-[#a855f7] font-mono block mb-1.5 select-none">
                Analyzing corridor state...
              </span>
              <div className="flex gap-1 items-center h-2 pl-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] bounce-1 inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] bounce-2 inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] bounce-3 inline-block" />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Preset Questions and Input Form */}
      <div className="border-t border-[#222222] p-4 bg-[#0d0d0d]">
        {/* Presets pills (hide if user has messages) */}
        {!hasUserMessages && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1.5 scrollbar-none select-none">
            <button
              onClick={() => handleSendMessage('Which station is most at risk?')}
              className="bg-[#1a1a1a] border border-[#333333] hover:border-[#555555] text-xs text-[#888888] hover:text-white rounded-full px-3 py-1.5 transition-colors duration-150 whitespace-nowrap outline-none"
            >
              Which station is most at risk?
            </button>
            <button
              onClick={() => handleSendMessage("What's the cascade impact?")}
              className="bg-[#1a1a1a] border border-[#333333] hover:border-[#555555] text-xs text-[#888888] hover:text-white rounded-full px-3 py-1.5 transition-colors duration-150 whitespace-nowrap outline-none"
            >
              What's the cascade impact?
            </button>
            <button
              onClick={() => handleSendMessage('Recommended actions?')}
              className="bg-[#1a1a1a] border border-[#333333] hover:border-[#555555] text-xs text-[#888888] hover:text-white rounded-full px-3 py-1.5 transition-colors duration-150 whitespace-nowrap outline-none"
            >
              Recommended actions?
            </button>
          </div>
        )}

        {/* Input Bar Form */}
        <form onSubmit={handleFormSubmit} className="flex gap-2 items-center relative">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Ask about corridor status..."
            className="flex-grow bg-[#111111] border border-[#333333] hover:border-[#444444] focus:border-[#a855f7] rounded-lg text-sm text-white px-3.5 py-2 outline-none transition-colors duration-200 placeholder-[#444] pr-10"
          />
          <button
            type="submit"
            className="absolute right-1.5 bg-[#a855f7] hover:bg-[#9333ea] text-white p-1.5 rounded-md transition-colors duration-200 outline-none active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-2.5 text-[9px] text-[#333333] text-center font-mono select-none uppercase tracking-wider">
          RailTwin Copilot · Powered by LangGraph + Gemini
        </div>
      </div>
    </div>
  );
};
