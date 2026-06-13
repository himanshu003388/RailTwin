import type { APIRoute } from 'astro';

export const prerender = false;

const GEMINI_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 1_000;

async function fetchWithRetry(url: string, body: object, attempt = 0): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.ok) return response;

    const status = response.status;
    const isTransient = status === 429 || status === 503 || status === 500;

    if (isTransient && attempt < MAX_RETRIES) {
      const retryAfter = response.headers.get('retry-after');
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`Gemini API ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, body, attempt + 1);
    }

    return response;
  } catch (err: any) {
    if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.code === 'UND_ERR_HEADERS_TIMEOUT')) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`Gemini API timed out, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, body, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { message, simulationState } = body;

  const sim = simulationState || {};
  const systemPrompt = `You are RailTwin AI, an expert Indian Railways copilot for the Delhi–Howrah Corridor.
Active Trains=${sim.activeTrains??5}, Stations at Risk=${sim.stationsAtRisk??0}, Delay=${sim.totalDelay??0}min, Passengers Affected=${sim.passengersAffected??0}, Weather=${sim.weather??'Clear'}, Efficiency=${sim.networkEfficiency??100}%.
Keep responses under 150 words. Reference train numbers (12301, 12305, etc.) and station codes (NDLS, CNB, ALD, PNBE, HWH).`;

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nOperator: ${message}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 200,
        }
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `Gemini error: ${err}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response from AI.';

    return new Response(JSON.stringify({ reply: text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
