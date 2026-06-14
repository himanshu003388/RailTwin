import type { APIRoute } from "astro";
import { getCorridorWeather } from "../../../lib/weather";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");

  try {
    const data = await getCorridorWeather();
    if (lat && lon) {
      return json({ lat: Number(lat), lon: Number(lon), ...data }, 200, "public, max-age=60");
    }
    return json(data, 200, "public, max-age=60");
  } catch (e) {
    return json({ error: "weather_unavailable", detail: (e as Error).message }, 502);
  }
};

function json(body: unknown, status: number, cache?: string): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cache) headers["Cache-Control"] = cache;
  return new Response(JSON.stringify(body), { status, headers });
}
