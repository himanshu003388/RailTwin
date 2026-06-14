import type { APIRoute } from 'astro';

export const prerender = false;

const GEMINI_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

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
    // If delay is short (< 8s), wait and retry; otherwise return immediately
    // to avoid exceeding the frontend timeout.
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
      if (delay > 8_000) return res; // too long — let the caller handle it
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
    `You are RailTwin AI, an expert Indian Railways copilot monitoring 7 major routes across India.\n` +
    `Active Trains=${sim.activeTrains ?? 7}, Stations at Risk=${sim.stationsAtRisk ?? 0}, ` +
    `Total Delay=${sim.totalDelay ?? 0}min, Passengers Affected=${sim.passengersAffected ?? 0}, ` +
    `Weather=${sim.weather ?? 'Clear'}, Efficiency=${sim.networkEfficiency ?? 100}%, ` +
    `Current Events=${sim.currentEvents ?? 'None'}.\n` +
    `Answer concisely (under 150 words), use bullet points, bold key values, and reference train numbers ` +
    `(12951 Mumbai Rajdhani, 12423 Dibrugarh Rajdhani, etc.) and station codes (MMCT, NDLS, HWH, MAS, SBC, GHY, DBRG, etc.).`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: `Operator question: ${message}` }] }],
    system_instruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
  };

  try {
    const res = await callGemini(MODEL, apiKey, requestBody);
    if (res.ok) {
      const data = await res.json();
      const reply =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
        'I could not generate a response. Please rephrase.';
      return new Response(JSON.stringify({ reply }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    const errData = await res.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `HTTP ${res.status}`;

    // User-friendly messages for common errors
    if (res.status === 404) {
      return new Response(JSON.stringify({
        reply: '⚠ **AI assistant is temporarily unavailable** — the language model I use has been retired by Google. An admin can fix this by setting `GEMINI_MODEL` to a current model name in the project environment variables.'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (res.status === 429 || /quota|rate.limit/i.test(errMsg)) {
      return new Response(JSON.stringify({
        reply: '⚠ **AI assistant is temporarily unavailable** — the free API quota has been exhausted. Add your own Gemini API key in Settings (gear icon) to continue using the copilot.'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      reply: '⚠ **AI assistant is temporarily unavailable**. Please try again later.'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const errMsg = err?.name === 'AbortError' ? 'request timed out' : String(err?.message || err);
    return new Response(JSON.stringify({
      reply: `⚠ **AI assistant is temporarily unavailable** (${errMsg}). Please try again later.`
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
