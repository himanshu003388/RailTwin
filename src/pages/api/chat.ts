import type { APIRoute } from 'astro';

// Render dynamically in Vercel or development; prerender as static in other production builds (like GitHub Pages) to satisfy the compiler
export const prerender = !process.env.VERCEL && process.env.NODE_ENV !== 'development';

export const GET: APIRoute = async () => {
  try {
    const hasKey = !!process.env.GEMINI_API_KEY;
    return new Response(JSON.stringify({ hasKey }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ hasKey: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, systemState, userApiKey } = await request.json();

    // Determine the API key: prioritize user's key sent from client, fallback to server environment variable
    const apiKey = (userApiKey || '').trim() || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "API key missing. Please configure GEMINI_API_KEY in your Vercel project environment variables, or enter your Gemini API Key in the settings (cog icon in top bar)."
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Format weather alert information
    const weatherAlertText = systemState.weatherAlert
      ? `Weather Alert: Severe ${systemState.weatherAlert.description} detected near ${systemState.weatherAlert.station.toUpperCase()} with ${systemState.weatherAlert.rainfall}mm/hr rainfall. Telemetry indicates localized speed restrictions are active.`
      : 'Corridor Weather: No active weather alerts. Clear weather and standard visibility along the entire Delhi–Howrah corridor.';

    // Format active simulation info
    const simulationText = systemState.simulation
      ? `Active Grid Simulation:
- Conflicts Detected: ${systemState.simulation.conflictsDetected} platform/signal block conflicts
- Projected Cascade Delay: ${systemState.simulation.cascadeDelay} minutes across corridor
- Passenger Impact: ${systemState.simulation.passengersAffected.toLocaleString()} passengers at risk of delay
- Stations Impacted: ${systemState.simulation.stationsImpacted.join(', ').toUpperCase()}`
      : 'Grid Simulation: No active simulation scenario running.';

    // Format active intervention and resolved state
    let interventionText = 'Operational Status: Awaiting telemetry. No dispatch interventions applied yet.';
    if (systemState.intervention) {
      interventionText = `Operational Intervention Applied: Recommendation ID "${systemState.intervention.accepted}" was executed by Operator "${systemState.intervention.operator}".`;
      if (systemState.resolved) {
        interventionText += `
Recalculation Results:
- Platform/Grid conflicts remaining: ${systemState.simulation ? systemState.simulation.conflictsDetected : 0}
- Cascade delay reduced to: ${systemState.resolved.newCascadeDelay} minutes
- Network risk levels reduced from CRITICAL to: ${systemState.resolved.riskReduction.split('→')[1] || 'MODERATE'}
- Net minutes saved across corridor: ${systemState.resolved.minutesSaved} minutes`;
      }
    }

    // Format station risks list
    const stationRisksText = Object.entries(systemState.stationRisks || {})
      .map(([id, r]: [string, any]) => {
        return `- ${id.toUpperCase()}: Crowd Risk = ${r.crowdRisk.toUpperCase()}, Delay Risk = ${r.delayRisk.toUpperCase()}, Conflicts = ${r.platformConflicts}`;
      })
      .join('\n');

    // Format trains info
    const trainsText = (systemState.trains || [])
      .map((t: any) => {
        return `- Train ${t.id} (${t.name}): Speed = ${t.speed} km/h, Progress = ${Math.round(t.routeProgress * 100)}%, Current Station = ${t.currentStation.toUpperCase()}, Next Station = ${t.nextStation.toUpperCase()}, Predicted Delay = ${t.predictedDelay} mins, Capacity = ${t.capacity}, Passengers = ${t.passengerCount}`;
      })
      .join('\n');

    // Construct high-context system prompt
    const systemPrompt = `You are the RailTwin Copilot, an advanced agentic digital twin assistant for train operations monitoring.
You have real-time access to the railway digital twin telemetry.

CURRENT SYSTEM TELEMETRY:

[1. Weather Alert Status]
${weatherAlertText}

[2. Network Health Metrics]
- Grid Operations Efficiency: ${systemState.networkHealth.efficiency}%
- On-Time Performance: ${systemState.networkHealth.onTimePerf}%
- Platform/Terminal Utilization: ${systemState.networkHealth.platformUtil}%
- Signal System Status: ${systemState.networkHealth.signalStatus.toUpperCase()}
- Active Corridor Alerts: ${systemState.networkHealth.activeAlerts}

[3. Active Dispatch Simulation & What-If Context]
${simulationText}

[4. Mitigation & Intervention Logs]
${interventionText}

[5. Station Risk Matrix]
${stationRisksText}

[6. Live Train Tracking telemetry]
${trainsText}

OPERATOR INTERACTION GUIDELINES:
1. Keep your responses professional, technical, and direct. Avoid conversational filler, marketing fluff, or long introductory clauses.
2. If the query is related to the railway network, rely strictly on the telemetry details provided above (which contains the active trains, stations, weather, and simulation state). Use the exact numbers (train speeds, station risk levels, delay minutes, simulated cascade delay) to show you have live digital twin access.
3. Determine the active stations, train IDs, train names, and routes dynamically from the [Live Train Tracking telemetry] and [Station Risk Matrix] sections above. The system is universal and handles whatever trains or corridors are present in the telemetry data.
4. If the query is unrelated to the active trains or digital twin (e.g., general knowledge, math calculations, general talk, or trivia), answer it directly, accurately, and helpfully while maintaining your professional/technical persona.
5. Suggest actual recommendations (e.g., train hold orders, crowd management, or passenger alerts) when asked about mitigation options for any conflicts or delays found in the telemetry.
6. Format your output with clean markdown. Bold key values, use bullet points for lists, and keep text crisp and highly scannable.
`;

    // Map messages history to Gemini API format (user -> 'user', copilot -> 'model')
    const contents = messages
      .filter((m: any) => m.sender === 'user' || m.sender === 'copilot')
      .map((m: any) => ({
        role: m.sender === 'copilot' ? 'model' : 'user',
        parts: [{ text: m.message }]
      }));

    // Call Gemini API (using gemini-2.5-flash as requested)
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
      console.error("Gemini API returned error:", data);
      return new Response(
        JSON.stringify({
          error: data.error?.message || "Gemini API call failed. Please verify your API Key."
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to generate a response. Please check corridor telemetry.";

    return new Response(
      JSON.stringify({ message: reply }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    console.error("Failed to run chat endpoint:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
