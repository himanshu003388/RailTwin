// Fast, quota-aware Gemini client with retry, backoff, caching, and fallback.

const SERVER_KEY = process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY ?? "";

const PRIMARY_MODEL = process.env.GEMINI_MODEL ?? import.meta.env.GEMINI_MODEL ?? "gemini-2.0-flash";

const BASE = "https://generativelanguage.googleapis.com/v1/models";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

interface CacheEntry {
  text: string;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(model: string, system: string, msgs: ChatMessage[]): string {
  return model + "::" + system + "::" + msgs.map((m) => m.role + ":" + m.text).join("|");
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildBody(system: string, msgs: ChatMessage[]) {
  return {
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents: msgs.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.95,
    },
  };
}

async function callModel(model: string, system: string, msgs: ChatMessage[], userApiKey?: string): Promise<string> {
  const key = userApiKey || SERVER_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const url = `${BASE}/${model}:generateContent?key=${key}`;
  const body = JSON.stringify(buildBody(system, msgs));
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    }

    // 429 = rate/quota. Respect Retry-After, then back off.
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      lastErr = new QuotaError(model);
      if (attempt < MAX_RETRIES) {
        const wait = retryAfter * 1000 || 600 * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw lastErr;
    }

    if (res.status === 404) {
      throw new Error(`Model '${model}' not found — it may have been deprecated. Check GEMINI_MODEL env var.`);
    }

    if (res.status >= 500) {
      lastErr = new Error(`Gemini ${res.status}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    }

    const detail = await res.text();
    throw new Error(`Gemini error ${res.status}: ${detail}`);
  }

  throw lastErr instanceof Error ? lastErr : new Error("Gemini call failed");
}

export class QuotaError extends Error {
  constructor(public model: string) {
    super(`Gemini quota exhausted for ${model}`);
    this.name = "QuotaError";
  }
}

/**
 * Generate a chat reply. Caches, retries with backoff, and falls back
 * to a secondary flash model if the primary hits its quota.
 */
export async function generateChat(
  system: string,
  messages: ChatMessage[],
  userApiKey?: string
): Promise<{ text: string; model: string; cached: boolean }> {
  const trimmed = messages.slice(-12);

  const key = cacheKey(PRIMARY_MODEL, system, trimmed);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return { text: hit.text, model: PRIMARY_MODEL, cached: true };
  }

  let text: string;
  let usedModel = PRIMARY_MODEL;

  try {
    text = await callModel(PRIMARY_MODEL, system, trimmed, userApiKey);
  } catch (err) {
    const fallbackModel = "gemini-2.5-flash";
    if (PRIMARY_MODEL !== fallbackModel) {
      console.warn(`[Gemini] Primary model ${PRIMARY_MODEL} failed, attempting fallback to ${fallbackModel}:`, err);
      try {
        usedModel = fallbackModel;
        text = await callModel(fallbackModel, system, trimmed, userApiKey);
      } catch (fallbackErr) {
        console.error(`[Gemini] Fallback model ${fallbackModel} also failed:`, fallbackErr);
        throw err;
      }
    } else {
      throw err;
    }
  }

  cache.set(key, { text, expires: Date.now() + CACHE_TTL_MS });
  return { text, model: usedModel, cached: false };
}
