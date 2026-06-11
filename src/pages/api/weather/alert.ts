import type { APIRoute } from 'astro';
import { getWeatherAlert } from '../../../lib/weather';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const alert = await getWeatherAlert();
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
