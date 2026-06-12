import type { APIRoute } from 'astro';
import { getCorridorWeather } from '../../../lib/weather';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const weather = await getCorridorWeather();
    return new Response(JSON.stringify(weather), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
