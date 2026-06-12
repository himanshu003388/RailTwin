import type { APIRoute } from 'astro';

export const prerender = false; // CRITICAL — tells Astro this is a server route

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

  // Build a rich system prompt with live simulation context
  const systemPrompt = `You are RailTwin AI, an expert operations copilot for Indian Railways. You are monitoring the Delhi–Howrah Corridor (1,531 km, 7 stations, 5 trains).

CURRENT SIMULATION STATE:
- Active Trains: ${simulationState?.activeTrains ?? 5}
- Stations at Risk: ${simulationState?.stationsAtRisk ?? 0}
- Total Estimated Delay: ${simulationState?.totalDelay ?? 0} minutes
- Passengers Affected: ${simulationState?.passengersAffected ?? 0}
- Current Events: ${simulationState?.currentEvents ?? 'None'}
- Weather Conditions: ${simulationState?.weather ?? 'Clear'}
- Network Efficiency: ${simulationState?.networkEfficiency ?? 100}%

You give concise, actionable recommendations. Use railway terminology. Keep responses under 150 words unless the operator asks for detail.
Always reference specific train numbers (12301 Rajdhani, 12305 Poorva, etc.) and station codes (NDLS, CNB, ALD, PNBE, HWH).`;

  const geminiPayload = {
    contents: [
      {
        parts: [
          { text: `${systemPrompt}\n\nOperator: ${message}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
    }
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
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
