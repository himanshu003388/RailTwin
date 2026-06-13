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
    const isTransient = res.status === 429 || res.status === 500 || res.status === 503;
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

// GET — lets the frontend know whether a server key is configured.
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

  const { message, simulationState, userApiKey } = body || {};
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI Copilot is not configured. Add GEMINI_API_KEY on the server or enter a key in Settings.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'No message provided.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const sim = simulationState || {};
  const systemPrompt =
    `You are RailTwin AI, an expert Indian Railways copilot for the Delhi–Howrah Corridor.\n` +
    `Active Trains=${sim.activeTrains ?? 5}, Stations at Risk=${sim.stationsAtRisk ?? 0}, ` +
    `Total Delay=${sim.totalDelay ?? 0}min, Passengers Affected=${sim.passengersAffected ?? 0}, ` +
    `Weather=${sim.weather ?? 'Clear'}, Efficiency=${sim.networkEfficiency ?? 100}%, ` +
    `Current Events=${sim.currentEvents ?? 'None'}.\n` +
    `Answer concisely (under 150 words), use bullet points, bold key values, and reference train numbers ` +
    `(12301, 12305...) and station codes (NDLS, CNB, ALD, PNBE, HWH).`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: `Operator question: ${message}` }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
  };

  let lastError = 'Unknown error';
  for (const model of MODELS) {
    try {
      const res = await callGemini(model, apiKey, requestBody);
      if (res.ok) {
        const data = await res.json();
        const reply =
          data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
          'I could not generate a response. Please rephrase.';
        return new Response(JSON.stringify({ reply }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      // Capture error; if it's a 404 (bad model) or 429 (rate-limited on that model), try the next model.
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

  return new Response(JSON.stringify({ error: lastError }), {
    status: 502, headers: { 'Content-Type': 'application/json' },
  });
};
