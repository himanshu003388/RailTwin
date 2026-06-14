import type { APIRoute } from "astro";
import { generateChat, QuotaError, type ChatMessage } from "../../../lib/gemini";

export const prerender = false;

const SYSTEM_PROMPT = `You are RailTwin Copilot, an assistant for a railway digital-twin dashboard.
Help operators understand train delays, station risk, weather impact, and what-if scenarios.
Be concise, accurate, and action-oriented. If you lack data, say so clearly.`;

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
    const result = await generateChat(SYSTEM_PROMPT, messages, userApiKey);
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
