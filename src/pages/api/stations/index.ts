import type { APIRoute } from 'astro';
import { getEnrichedStations } from '../../../lib/train-engine';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const stations = getEnrichedStations();
    return new Response(JSON.stringify(stations), {
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
