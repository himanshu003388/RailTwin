import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { Bot, Send, User, Info, Settings } from 'lucide-react';
import { SettingsModal } from '../ui/SettingsModal';

export const CopilotChat: React.FC = () => {
  const copilot = useDemoStore(state => state.copilot);
  const geminiApiKey = useDemoStore(state => state.geminiApiKey);
  const messages = copilot.messages;
  
  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(!!geminiApiKey);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkBackendKey = async () => {
      try {
        const res = await fetch('/api/chat');
        if (res.ok) {
          const data = await res.json();
          if (data.hasKey) {
            setIsLiveActive(true);
            return;
          }
        }
      } catch (e) {
        console.warn("Could not fetch backend key status", e);
      }
      setIsLiveActive(!!geminiApiKey);
    };

    checkBackendKey();
  }, [geminiApiKey]);

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

  const callGeminiClientSide = async (msgs: any[], systemState: any, apiKey: string): Promise<string> => {
    const weatherAlertText = systemState.weatherAlert
      ? `Weather Alert: Severe ${systemState.weatherAlert.description} detected near ${systemState.weatherAlert.station.toUpperCase()} with ${systemState.weatherAlert.rainfall}mm/hr rainfall. Localized speed restrictions are active.`
      : 'Corridor Weather: No active weather alerts. Clear weather along the entire Delhi–Howrah corridor.';

    const simulationText = systemState.simulation
      ? `Active Grid Simulation:
- Conflicts Detected: ${systemState.simulation.conflictsDetected} conflicts
- Projected Cascade Delay: ${systemState.simulation.cascadeDelay} minutes
- Passenger Impact: ${systemState.simulation.passengersAffected.toLocaleString()} passengers at risk
- Stations Impacted: ${systemState.simulation.stationsImpacted.join(', ').toUpperCase()}`
      : 'Grid Simulation: No active simulation scenario running.';

    let interventionText = 'Operational Status: No dispatch interventions applied yet.';
    if (systemState.intervention) {
      interventionText = `Operational Intervention Applied: Recommendation ID "${systemState.intervention.accepted}" executed by Operator "${systemState.intervention.operator}".`;
      if (systemState.resolved) {
        interventionText += `
Recalculation Results:
- Conflicts remaining: ${systemState.simulation ? systemState.simulation.conflictsDetected : 0}
- Cascade delay: ${systemState.resolved.newCascadeDelay} minutes
- Risk levels: ${systemState.resolved.riskReduction}
- Minutes saved: ${systemState.resolved.minutesSaved} minutes`;
      }
    }

    const stationRisksText = Object.entries(systemState.stationRisks || {})
      .map(([id, r]: [string, any]) => `- ${id.toUpperCase()}: Crowd Risk = ${r.crowdRisk.toUpperCase()}, Delay Risk = ${r.delayRisk.toUpperCase()}, Conflicts = ${r.platformConflicts}`)
      .join('\n');

    const trainsText = (systemState.trains || [])
      .map((t: any) => `- Train ${t.id} (${t.name}): Speed = ${t.speed} km/h, Current = ${t.currentStation.toUpperCase()}, Next = ${t.nextStation.toUpperCase()}, Delay = ${t.predictedDelay} mins, Passengers = ${t.passengerCount}`)
      .join('\n');

    const systemPrompt = `You are the RailTwin Copilot, an advanced digital twin assistant for the Delhi–Howrah rail corridor.
You have real-time access to the corridor telemetry.

CURRENT TELEMETRY:
[Weather] ${weatherAlertText}
[Network Health]
- Efficiency: ${systemState.networkHealth.efficiency}%
- On-Time: ${systemState.networkHealth.onTimePerf}%
- Platform Util: ${systemState.networkHealth.platformUtil}%
- Signal Status: ${systemState.networkHealth.signalStatus.toUpperCase()}
[Simulation]
${simulationText}
[Interventions]
${interventionText}
[Station Risks]
${stationRisksText}
[Active Trains]
${trainsText}

GUIDELINES:
1. Talk directly to the dispatcher. Keep responses highly professional, technical, and concise. No fluff.
2. Use the exact telemetry numbers above.
3. Suggest clear mitigations (e.g. holds, alerts) when asked.
4. Delhi-Howrah corridor key stations: NDLS, CNB, PRYJ/ALD, DDU, PNBE, GAYA, DHN, HWH.
5. Use clean markdown formatting.
`;

    const contents = msgs
      .filter(m => m.sender === 'user' || m.sender === 'copilot')
      .map(m => ({
        role: m.sender === 'copilot' ? 'model' : 'user',
        parts: [{ text: m.message }]
      }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Direct API call to Gemini failed.");
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated by the AI.";
  };

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

      try {
        // Try calling Vercel/local Astro backend API first
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentMessages,
            systemState,
            userApiKey: state.geminiApiKey
          })
        });

        if (response.ok) {
          const data = await response.json();
          replyMessage = data.message;
          setIsLiveActive(true);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn("Server API returned error status:", response.status, errData);

          if (state.geminiApiKey) {
            // Fallback to client direct call
            replyMessage = await callGeminiClientSide(currentMessages, systemState, state.geminiApiKey);
            setIsLiveActive(true);
          } else {
            throw new Error(errData.error || "Gemini API key is not configured.");
          }
        }
      } catch (fetchErr: any) {
        console.warn("Failed to reach server API route or received error. Checking client-side key fallback...", fetchErr);
        if (state.geminiApiKey) {
          replyMessage = await callGeminiClientSide(currentMessages, systemState, state.geminiApiKey);
          setIsLiveActive(true);
        } else {
          throw new Error(fetchErr.message || "Failed to reach server API route, and no client-side Gemini API key was configured.");
        }
      }

      useDemoStore.setState(s => ({
        copilot: {
          ...s.copilot,
          thinking: false,
          messages: [...s.copilot.messages, { id: `copilot-msg-${Date.now()}`, sender: 'copilot' as const, message: replyMessage, timestamp: new Date() }]
        }
      }));

    } catch (err: any) {
      console.error("Error generating AI reply:", err);
      useDemoStore.setState(s => ({
        copilot: {
          ...s.copilot,
          thinking: false,
          messages: [...s.copilot.messages, {
            id: `copilot-msg-${Date.now()}`,
            sender: 'copilot' as const,
            message: `⚠️ **API Key Required**\n\n${err.message || "Gemini API key is missing or invalid."}\n\nPlease enter your Gemini API Key in the Settings panel (cog icon in top bar) to chat with the live Digital Twin Copilot.`,
            timestamp: new Date()
          }]
        }
      }));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendMessage(inputText);
    setInputText('');
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
              Ask queries about the Delhi-Howrah corridor trains, risks, weather impacts, or active simulations.
            </span>
            {isLiveActive ? (
              <div
                className="flex items-center gap-1.5 text-[10px] rounded-lg px-3 py-1.5"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--color-accent-green)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                <span>Live AI Agent Mode (Gemini 2.5)</span>
              </div>
            ) : (
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-1.5 text-[10px] rounded-lg px-3 py-1.5 transition-colors duration-150 hover:bg-bg-hover cursor-pointer"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-tertiary)' }}
              >
                <Info className="w-3 h-3 text-accent-yellow" />
                <span>Configure Gemini API Key to activate AI</span>
              </button>
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
                onClick={() => handleSendMessage(q)}
                className="text-xs rounded-full px-3 py-1.5 transition-all duration-150 whitespace-nowrap outline-none cursor-pointer"
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
            className="absolute right-1.5 text-white p-1.5 rounded-md transition-colors duration-200 outline-none active:scale-95 cursor-pointer"
            style={{ background: 'var(--color-accent-purple)', boxShadow: '0 0 8px rgba(168,85,247,0.4)' }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-2.5 text-[9px] text-text-muted text-center font-mono select-none uppercase tracking-wider flex items-center justify-center gap-1.5">
          <span>RailTwin Copilot · Powered by Gemini Agent API</span>
          <span className={`w-1 h-1 rounded-full ${isLiveActive ? 'bg-accent-green' : 'bg-accent-yellow'}`} />
          <span className="text-[8px]">{isLiveActive ? 'LIVE ACTIVE' : 'KEY REQUIRED'}</span>
        </div>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};
