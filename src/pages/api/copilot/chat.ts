import type { APIRoute } from 'astro';

export const prerender = false;

const GEMINI_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 1_000;

async function fetchGeminiWithRetry(url: string, body: object, attempt = 0): Promise<Response> {
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
      return fetchGeminiWithRetry(url, body, attempt + 1);
    }

    return response;
  } catch (err: any) {
    if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.code === 'UND_ERR_HEADERS_TIMEOUT')) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`Gemini API timed out, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return fetchGeminiWithRetry(url, body, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const GET: APIRoute = async () => {
  try {
    const hasKey = !!process.env.GEMINI_API_KEY;
    return new Response(JSON.stringify({ hasKey }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ hasKey: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, systemState, userApiKey } = await request.json();

    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI Copilot is not configured. GEMINI_API_KEY is missing. Please configure it in Settings." }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
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
      .map((t: any) => `${t.id}(${t.name}): ${t.speed}km/h, ${Math.round(t.routeProgress*100)}%, at ${t.currentStation.toUpperCase()}, delay=${t.predictedDelay}min, ${t.passengerCount}/${t.capacity}pax`)
      .join(' | ');

    const systemPrompt = `You are RailTwin Copilot for Indian Railways. Answer concisely.

Telemetry: ${weatherLine} ${simLine} ${interventionLine}
Network: eff=${ss.networkHealth?.efficiency??'N/A'}%, onTime=${ss.networkHealth?.onTimePerf??'N/A'}%, signals=${(ss.networkHealth?.signalStatus??'unknown').toUpperCase()}
Stations: ${stationRisksLine}
Trains: ${trainsLine}

Be direct, technical. Use bullet points. Bold key values.`;

    const contents = messages
      .filter((m: any) => m.sender === 'user' || m.sender === 'copilot')
      .map((m: any) => ({
        role: m.sender === 'copilot' ? 'model' : 'user',
        parts: [{ text: m.message }]
      }));

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetchGeminiWithRetry(geminiUrl, {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 300 }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: data.error?.message || "Gemini API call failed" }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to generate a response.";

    return new Response(JSON.stringify({ message: reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
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
