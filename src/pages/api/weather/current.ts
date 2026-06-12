import type { APIRoute } from 'astro';
import { getCorridorWeather } from '../../../lib/weather';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const customApiKey = request.headers.get('x-openweather-api-key') || undefined;
    const weather = await getCorridorWeather(customApiKey);
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
