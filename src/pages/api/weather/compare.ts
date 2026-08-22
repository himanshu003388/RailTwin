import type { APIRoute } from 'astro';
import { getDualSourceWeather } from '../../../lib/weather';

export const prerender = false;

// GET /api/weather/compare?station=bsl
// Returns the same station's weather from two independent sources so the
// client-side reconciler can surface genuine source conflicts.
export const GET: APIRoute = async ({ url }) => {
  const station = (url.searchParams.get('station') || 'ndls').toLowerCase();
  try {
    const result = await getDualSourceWeather(station);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
