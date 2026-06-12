import type { APIRoute } from 'astro';

export const prerender = false;

const GEMINI_TIMEOUT_MS = 50_000;

async function fetchGeminiWithTimeout(url: string, body: object): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { systemState, userApiKey } = await request.json();

    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI Copilot is not configured. GEMINI_API_KEY is missing. Please configure it in Settings." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const weatherAlertText = systemState.weatherAlert
      ? `Weather Alert: Severe ${systemState.weatherAlert.description} detected near ${systemState.weatherAlert.station.toUpperCase()} with ${systemState.weatherAlert.rainfall}mm/hr rainfall.`
      : 'Corridor Weather: No active weather alerts. Clear weather along the entire Delhi–Howrah corridor.';

    const simulationText = systemState.simulation
      ? `Active Grid Simulation:\n- Conflicts Detected: ${systemState.simulation.conflictsDetected} platform/signal block conflicts\n- Projected Cascade Delay: ${systemState.simulation.cascadeDelay} minutes across corridor\n- Passenger Impact: ${systemState.simulation.passengersAffected.toLocaleString()} passengers at risk of delay\n- Stations Impacted: ${systemState.simulation.stationsImpacted.join(', ').toUpperCase()}`
      : 'Grid Simulation: No active simulation scenario running.';

    const stationRisksText = Object.entries(systemState.stationRisks || {})
      .map(([id, r]: [string, any]) => `- ${id.toUpperCase()}: Crowd Risk = ${r.crowdRisk.toUpperCase()}, Delay Risk = ${r.delayRisk.toUpperCase()}, Conflicts = ${r.platformConflicts}`)
      .join('\n');

    const trainsText = (systemState.trains || [])
      .map((t: any) => `- Train ${t.id} (${t.name}): Speed = ${t.speed} km/h, Progress = ${Math.round(t.routeProgress * 100)}%, Current Station = ${t.currentStation.toUpperCase()}, Next Station = ${t.nextStation.toUpperCase()}, Predicted Delay = ${t.predictedDelay} mins, Capacity = ${t.capacity}, Passengers = ${t.passengerCount}`)
      .join('\n');

    const systemPrompt = `You are the RailTwin Copilot, an advanced agentic digital twin assistant for train operations monitoring.
Analyze the current railway digital twin telemetry and generate exactly 3 structured operational mitigation recommendations to resolve the conflicts and delays.

CURRENT SYSTEM TELEMETRY:

[1. Weather Alert Status]
${weatherAlertText}

[2. Active Dispatch Simulation & What-If Context]
${simulationText}

[3. Station Risk Matrix]
${stationRisksText}

[4. Live Train Tracking telemetry]
${trainsText}

Respond ONLY with a JSON object matching this schema:
{
  "recommendations": [
    {
      "id": "rec-1",
      "priority": 1,
      "action": "Issue hold order for 12303 at Allahabad Junction (18-min hold resolves platform conflict)",
      "impact": "Eliminates 3 platform conflicts and saves 33 minutes cascade delay"
    },
    {
      "id": "rec-2",
      "priority": 2,
      "action": "Deploy crowd management to Patna platform 5 & 7",
      "impact": "Reduces crowd risk from CRITICAL to MODERATE"
    },
    {
      "id": "rec-3",
      "priority": 3,
      "action": "Push passenger alerts via NTES for 12301",
      "impact": "Notifies 920 passengers of delay"
    }
  ]
}

Ensure the ID field values are unique, starting from "rec-1" to "rec-3". The recommended actions must target the active trains, delay stations, or conflicts detected in the digital twin telemetry.
Do not include any formatting other than the valid raw JSON object. Do not include markdown code block syntax. Return strictly valid JSON.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetchGeminiWithTimeout(geminiUrl, {
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: data.error?.message || "Gemini API call failed" }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Fallback cleanup of code block syntax if returned
    reply = reply.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(reply);
      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        throw new Error("Missing recommendations list");
      }
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (parseErr) {
      console.error("Failed to parse Gemini output:", reply);
      return new Response(
        JSON.stringify({ error: "AI generated an invalid structured recommendation schema. Please try again." }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    const message = err.name === 'AbortError'
      ? 'Gemini API request timed out. Please try again.'
      : err.message || 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: err.name === 'AbortError' ? 504 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
