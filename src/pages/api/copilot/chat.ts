import type { APIRoute } from "astro";
import { generateChat, QuotaError, type ChatMessage } from "../../../lib/gemini";

export const prerender = false;

const SYSTEM_PROMPT = `You are RailTwin Copilot, an assistant for a railway digital-twin dashboard.
Help operators understand train delays, station risk, weather impact, what-if scenarios,
and drift/reconciliation (how far the live situation has moved from the recorded baseline context).
Drift scores are computed deterministically by the drift engine (0.40 schedule + 0.25 position +
0.20 prediction + 0.15 weather) — you explain them, you never invent or recompute them.
Be concise, accurate, and action-oriented. If you lack data, say so clearly.`;

/** Render the client-provided drift/reconciliation state into prompt context. */
function buildDriftContext(systemState: any): string {
  const drift = systemState?.drift;
  if (!drift) return '';
  const lines: string[] = ['\n\n--- LIVE DRIFT & RECONCILIATION CONTEXT ---'];
  if (drift.baselineName) {
    lines.push(`Baseline: "${drift.baselineName}" captured ${drift.capturedAt} (${Math.round(drift.elapsedMinutes ?? 0)} min ago).`);
  }
  if (typeof drift.corridorScore === 'number') {
    lines.push(`Corridor drift score: ${drift.corridorScore}/100 (${drift.corridorClass}).`);
  }
  if (Array.isArray(drift.topTrains)) {
    for (const t of drift.topTrains.slice(0, 4)) {
      lines.push(`Train ${t.trainId} (${t.trainName}): drift ${t.score}/100 [${t.driftClass}] — ${t.explanation}`);
    }
  }
  if (Array.isArray(drift.openItems) && drift.openItems.length > 0) {
    lines.push(`Open reconciliation items (${drift.openItems.length}):`);
    for (const i of drift.openItems.slice(0, 6)) {
      lines.push(`- [${i.type}] ${i.entityLabel} · ${i.field}: ${i.sourceA?.name} says ${i.sourceA?.value} vs ${i.sourceB?.name} says ${i.sourceB?.value}. Suggested: ${i.suggestedResolution}.`);
    }
  }
  lines.push('--- END CONTEXT ---');
  return lines.join('\n');
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const userApiKey = body?.userApiKey || undefined;

  let messages: ChatMessage[] = [];
  if (Array.isArray(body?.messages)) {
    messages = body.messages
      .filter((m: any) => m && typeof m.text === "string")
      .map((m: any) => ({
        role: m.role === "model" || m.role === "assistant" ? "model" : "user",
        text: String(m.text),
      }));
  } else if (typeof body?.message === "string") {
    messages = [{ role: "user", text: body.message }];
  }

  if (messages.length === 0) {
    return json({ error: "messages[] or message is required" }, 400);
  }

  try {
    const systemPrompt = SYSTEM_PROMPT + buildDriftContext(body?.systemState);
    const result = await generateChat(systemPrompt, messages, userApiKey);
    return json({ reply: result.text, model: result.model, cached: result.cached }, 200);
  } catch (e) {
    if (e instanceof QuotaError) {
      return json(
        {
          error: "quota_exhausted",
          reply:
            "The AI service has hit its daily free-tier limit. Please try again later or upgrade the Gemini plan.",
        },
        429
      );
    }
    return json({ error: "chat_failed", detail: (e as Error).message }, 502);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
