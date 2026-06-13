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

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ hasKey: !!process.env.GEMINI_API_KEY }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages, systemState, userApiKey } = body || {};
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI Copilot is not configured. Add GEMINI_API_KEY on the server or enter a key in Settings.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'No messages history provided.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const ss = systemState || {};

  const weatherLine = ss.weatherAlert
    ? `Weather: ${ss.weatherAlert.description} at ${ss.weatherAlert.station.toUpperCase()} (${ss.weatherAlert.rainfall}mm/hr).`
    : 'Weather: Clear.';

  const simLine = ss.simulation
    ? `Simulation: ${ss.simulation.conflictsDetected} conflicts, ${ss.simulation.cascadeDelay}min cascade delay, ${(ss.simulation.passengersAffected || 0).toLocaleString()} passengers affected at ${(ss.simulation.stationsImpacted || []).join(', ').toUpperCase()}.`
    : 'Simulation: None.';

  let interventionLine = 'Intervention: None.';
  if (ss.intervention) {
    interventionLine = `Intervention: "${ss.intervention.accepted}" accepted by ${ss.intervention.operator}.`;
    if (ss.resolved) {
      interventionLine += ` Conflicts: ${ss.simulation ? ss.simulation.conflictsDetected : 0}, Delay reduced to ${ss.resolved.newCascadeDelay}min, Saved ${ss.resolved.minutesSaved}min.`;
    }
  }

  const stationRisksLine = Object.entries(ss.stationRisks || {})
    .map(([id, r]: [string, any]) => `${id.toUpperCase()}: crowd=${r.crowdRisk}, delay=${r.delayRisk}, conflicts=${r.platformConflicts}`)
    .join('; ');

  const trainsLine = (ss.trains || [])
    .map((t: any) => `${t.id}(${t.name}): ${t.speed}km/h, ${Math.round(t.routeProgress * 100)}%, at ${t.currentStation.toUpperCase()}, delay=${t.predictedDelay}min, ${t.passengerCount}/${t.capacity}pax`)
    .join(' | ');

  const systemPrompt = `You are RailTwin Copilot for Indian Railways. Answer concisely.

Telemetry: ${weatherLine} ${simLine} ${interventionLine}
Network: eff=${ss.networkHealth?.efficiency ?? 'N/A'}%, onTime=${ss.networkHealth?.onTimePerf ?? 'N/A'}%, signals=${(ss.networkHealth?.signalStatus ?? 'unknown').toUpperCase()}
Stations: ${stationRisksLine}
Trains: ${trainsLine}

Be direct, technical. Use bullet points. Bold key values.`;

  const contents = messages
    .filter((m: any) => m.sender === 'user' || m.sender === 'copilot')
    .map((m: any) => ({
      role: m.sender === 'copilot' ? 'model' : 'user',
      parts: [{ text: m.message }]
    }));

  let lastError = 'Unknown error';
  for (const model of MODELS) {
    try {
      const res = await callGemini(model, apiKey, {
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.3, maxOutputTokens: 300 }
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          return new Response(JSON.stringify({ message: reply }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          });
        }
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
};
