import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// GET / - check if Gemini API key is configured
router.get('/', (req, res) => {
  try {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({ hasKey });
  } catch (err) {
    res.status(500).json({ hasKey: false, error: err.message });
  }
});

// POST / - chat generation
router.post('/', async (req, res) => {
  try {
    const { messages, systemState, userApiKey } = req.body;

    // Determine the API key: prioritize user's key sent from client, fallback to server environment variable
    const apiKey = (userApiKey || '').trim() || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: "API key missing. Please configure GEMINI_API_KEY in your backend environment variables, or enter your Gemini API Key in the settings (cog icon in top bar)."
      });
    }

    // Format weather alert information
    const weatherAlertText = systemState.weatherAlert
      ? `Weather Alert: Severe ${systemState.weatherAlert.description} detected near ${systemState.weatherAlert.station.toUpperCase()} with ${systemState.weatherAlert.rainfall}mm/hr rainfall. Telemetry indicates localized speed restrictions are active.`
      : 'Corridor Weather: No active weather alerts. Clear weather along the entire corridor.';

    // Format active simulation info
    const simulationText = systemState.simulation
      ? `Active Grid Simulation:
- Conflicts Detected: ${systemState.simulation.conflictsDetected} conflicts
- Projected Cascade Delay: ${systemState.simulation.cascadeDelay} minutes
- Passenger Impact: ${systemState.simulation.passengersAffected.toLocaleString()} passengers at risk
- Stations Impacted: ${systemState.simulation.stationsImpacted.join(', ').toUpperCase()}`
      : 'Grid Simulation: No active simulation scenario running.';

    // Format active intervention and resolved state
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

    // Format station risks list
    const stationRisksText = Object.entries(systemState.stationRisks || {})
      .map(([id, r]) => `- ${id.toUpperCase()}: Crowd Risk = ${r.crowdRisk.toUpperCase()}, Delay Risk = ${r.delayRisk.toUpperCase()}, Conflicts = ${r.platformConflicts}`)
      .join('\n');

    // Format trains info
    const trainsText = (systemState.trains || [])
      .map((t) => `- Train ${t.id} (${t.name}): Speed = ${t.speed} km/h, Current = ${t.currentStation.toUpperCase()}, Next = ${t.nextStation.toUpperCase()}, Delay = ${t.predictedDelay} mins, Passengers = ${t.passengerCount}`)
      .join('\n');

    // Construct high-context system prompt
    const systemPrompt = `You are the RailTwin Copilot, an advanced digital twin assistant for train operations monitoring.
You have real-time access to the railway digital twin telemetry.

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
1. Keep responses professional, technical, and concise. No fluff.
2. If the query is related to the railway network, use the exact telemetry numbers above. Determine active stations, train IDs, names, and routes dynamically from the telemetry list.
3. If the query is unrelated to the active trains (e.g., general knowledge, math, calculations, or trivia), answer it directly and helpfully in a professional/technical manner.
4. Suggest clear mitigations (e.g. holds, alerts) when asked.
5. Use clean markdown formatting.
`;

    // Map messages history to Gemini API format (user -> 'user', copilot -> 'model')
    const contents = messages
      .filter((m) => m.sender === 'user' || m.sender === 'copilot')
      .map((m) => ({
        role: m.sender === 'copilot' ? 'model' : 'user',
        parts: [{ text: m.message }]
      }));

    // Call Gemini API (using gemini-2.5-flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
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
      console.error("Gemini API error in backend:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Direct API call to Gemini failed."
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated by the AI.";
    res.json({ message: reply });
  } catch (err) {
    console.error("Failed to run chat endpoint in backend:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
