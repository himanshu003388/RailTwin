import type { APIRoute } from "astro";
import { generateChat, QuotaError, type ChatMessage } from "../../../lib/gemini";

export const prerender = false;

const SYSTEM_PROMPT = `You are RailTwin's recommendation engine. Given current network state
(delays, weather severity, station risk), output 3-5 short, prioritized, actionable
recommendations for rail operators. Return plain bullet lines, no preamble.`;

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  // Pass whatever network context the frontend has as a single user message.
  const context = JSON.stringify(body?.context ?? body ?? {});
  const messages: ChatMessage[] = [
    { role: "user", text: `Current network state:\n${context}\n\nGive recommendations.` },
  ];

  try {
    const result = await generateChat(SYSTEM_PROMPT, messages);
    const recommendations = result.text
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.\s]+/, "").trim())
      .filter(Boolean);
    return json({ recommendations, model: result.model, cached: result.cached }, 200);
  } catch (e) {
    if (e instanceof QuotaError) {
      return json({ error: "quota_exhausted", recommendations: [] }, 429);
    }
    return json({ error: "recommendations_failed", detail: (e as Error).message }, 502);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
