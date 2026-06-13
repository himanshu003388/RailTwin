import type { APIRoute } from 'astro';

export const prerender = false;

const GEMINI_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;

// Models tried in order — fall back if one is unavailable for the key.
const MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash'];

async function callGemini(model: string, apiKey: string, body: object, attempt = 0): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.ok) return res;

    // For 429, parse the retry delay from Gemini's error message.
    if (res.status === 429 && attempt < MAX_RETRIES) {
      let delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      try {
        const errData = await res.clone().json();
        const msg = errData?.error?.message || '';
        const match = msg.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i);
        if (match) {
          delay = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
        }
      } catch {}
      if (delay > 8_000) return res;
      await new Promise(r => setTimeout(r, delay));
      return callGemini(model, apiKey, body, attempt + 1);
    }

    const isTransient = res.status === 500 || res.status === 503;
    if (isTransient && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
      return callGemini(model, apiKey, body, attempt + 1);
    }
    return res;
  } catch (err: any) {
    if (attempt < MAX_RETRIES && err.name === 'AbortError') {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
      return callGemini(model, apiKey, body, attempt + 1);
    }
    throw err;
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

    let lastError = 'Unknown error';
    let responseOk = false;
    let data: any;

    for (const model of MODELS) {
      try {
        const res = await callGemini(model, apiKey, {
          contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });

        if (res.ok) {
          data = await res.json();
          responseOk = true;
          break;
        }

        const errData = await res.json().catch(() => ({}));
        lastError = errData?.error?.message || `HTTP ${res.status}`;
        if (res.status !== 404 && res.status !== 429) {
          return new Response(JSON.stringify({ error: lastError }), {
            status: res.status, headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (err: any) {
        lastError = err?.name === 'AbortError' ? 'Gemini request timed out.' : String(err?.message || err);
      }
    }

    if (!responseOk) {
      const isQuotaError = /quota|rate.limit/i.test(lastError);
      if (isQuotaError) {
        return new Response(JSON.stringify({
          error: 'quota_exceeded',
          message: 'The Gemini API free tier quota is exhausted. Add your own API key in Settings (gear icon) to continue using the copilot.'
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: lastError }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }
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
