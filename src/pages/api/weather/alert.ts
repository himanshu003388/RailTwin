import type { APIRoute } from 'astro';
import { getWeatherAlert } from '../../../lib/weather';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const customApiKey = request.headers.get('x-openweather-api-key') || undefined;
    const alert = await getWeatherAlert(customApiKey);
    return new Response(JSON.stringify(alert), {
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
