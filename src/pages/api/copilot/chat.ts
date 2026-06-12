import type { APIRoute } from 'astro';

export const prerender = false;

const GEMINI_TIMEOUT_MS = 50_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_500;

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

    const weatherAlertText = systemState.weatherAlert
      ? `Weather Alert: Severe ${systemState.weatherAlert.description} detected near ${systemState.weatherAlert.station.toUpperCase()} with ${systemState.weatherAlert.rainfall}mm/hr rainfall. Telemetry indicates localized speed restrictions are active.`
      : 'Corridor Weather: No active weather alerts. Clear weather and standard visibility along the entire Delhi–Howrah corridor.';

    const simulationText = systemState.simulation
      ? `Active Grid Simulation:\n- Conflicts Detected: ${systemState.simulation.conflictsDetected} platform/signal block conflicts\n- Projected Cascade Delay: ${systemState.simulation.cascadeDelay} minutes across corridor\n- Passenger Impact: ${systemState.simulation.passengersAffected.toLocaleString()} passengers at risk of delay\n- Stations Impacted: ${systemState.simulation.stationsImpacted.join(', ').toUpperCase()}`
      : 'Grid Simulation: No active simulation scenario running.';

    let interventionText = 'Operational Status: Awaiting telemetry. No dispatch interventions applied yet.';
    if (systemState.intervention) {
      interventionText = `Operational Intervention Applied: Recommendation ID "${systemState.intervention.accepted}" was executed by Operator "${systemState.intervention.operator}".`;
      if (systemState.resolved) {
        interventionText += `\nRecalculation Results:\n- Platform/Grid conflicts remaining: ${systemState.simulation ? systemState.simulation.conflictsDetected : 0}\n- Cascade delay reduced to: ${systemState.resolved.newCascadeDelay} minutes\n- Network risk levels reduced from CRITICAL to: ${systemState.resolved.riskReduction.split('→')[1] || 'MODERATE'}\n- Net minutes saved across corridor: ${systemState.resolved.minutesSaved} minutes`;
      }
    }

    const stationRisksText = Object.entries(systemState.stationRisks || {})
      .map(([id, r]: [string, any]) => `- ${id.toUpperCase()}: Crowd Risk = ${r.crowdRisk.toUpperCase()}, Delay Risk = ${r.delayRisk.toUpperCase()}, Conflicts = ${r.platformConflicts}`)
      .join('\n');

    const trainsText = (systemState.trains || [])
      .map((t: any) => `- Train ${t.id} (${t.name}): Speed = ${t.speed} km/h, Progress = ${Math.round(t.routeProgress * 100)}%, Current Station = ${t.currentStation.toUpperCase()}, Next Station = ${t.nextStation.toUpperCase()}, Predicted Delay = ${t.predictedDelay} mins, Capacity = ${t.capacity}, Passengers = ${t.passengerCount}`)
      .join('\n');

    const systemPrompt = `You are the RailTwin Copilot, an advanced agentic digital twin assistant for train operations monitoring.
You have real-time access to the railway digital twin telemetry.

CURRENT SYSTEM TELEMETRY:

[1. Weather Alert Status]
${weatherAlertText}

[2. Network Health Metrics]
- Grid Operations Efficiency: ${systemState.networkHealth?.efficiency ?? 'N/A'}%
- On-Time Performance: ${systemState.networkHealth?.onTimePerf ?? 'N/A'}%
- Platform/Terminal Utilization: ${systemState.networkHealth?.platformUtil ?? 'N/A'}%
- Signal System Status: ${(systemState.networkHealth?.signalStatus ?? 'unknown').toUpperCase()}
- Active Corridor Alerts: ${systemState.networkHealth?.activeAlerts ?? 'N/A'}

[3. Active Dispatch Simulation & What-If Context]
${simulationText}

[4. Mitigation & Intervention Logs]
${interventionText}

[5. Station Risk Matrix]
${stationRisksText}

[6. Live Train Tracking telemetry]
${trainsText}

OPERATOR INTERACTION GUIDELINES:
1. Keep your responses professional, technical, and direct.
2. If the query is related to the railway network, rely strictly on the telemetry details provided above.
3. Determine the active stations, train IDs, train names, and routes dynamically from the telemetry data.
4. If the query is unrelated to the active trains or digital twin, answer it directly and helpfully.
5. Suggest actual recommendations when asked about mitigation options.
6. Format your output with clean markdown. Bold key values, use bullet points for lists.`;

    const contents = messages
      .filter((m: any) => m.sender === 'user' || m.sender === 'copilot')
      .map((m: any) => ({
        role: m.sender === 'copilot' ? 'model' : 'user',
        parts: [{ text: m.message }]
      }));

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetchGeminiWithRetry(geminiUrl, {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
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
