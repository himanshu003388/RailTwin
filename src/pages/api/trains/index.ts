import type { APIRoute } from 'astro';
import { getTrains } from '../../../lib/train-engine';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const trains = getTrains();
    return new Response(JSON.stringify(trains), {
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
